import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatArea.css';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  updateDoc
} from 'firebase/firestore';

function ChatArea({ chatHistory, setChatHistory, newChatSignal, resetNewChatSignal, selectedChatIndex, clearChatAreaSignal, resetClearChatAreaSignal }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [user, setUser] = useState(null);
  const [currentChatIndex, setCurrentChatIndex] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const controllerRef = useRef(null);
  const typingInterrupted = useRef(false);
  const partialResponseRef = useRef('');
  const chatEndRef = useRef(null);
  const containerRef = useRef(null);
  const dataLoadedRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  const apiTimeoutRef = useRef(null);
  const themeMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Suggestion cards for empty state
  const suggestionCards = [
    {
      title: "Code & Development",
      icon: "fas fa-code",
      suggestions: [
        "Help me debug this JavaScript function",
        "Explain how to implement authentication in React",
        "Convert this SQL query to MongoDB"
      ]
    },
    {
      title: "Learn & Research",
      icon: "fas fa-book",
      suggestions: [
        "Explain quantum computing in simple terms",
        "Summarize recent advances in renewable energy",
        "Teach me about machine learning basics"
      ]
    },
    {
      title: "Creative Ideas",
      icon: "fas fa-lightbulb",
      suggestions: [
        "Brainstorm marketing strategies for a small business",
        "Generate names for a new tech startup",
        "Design a weekly meal plan with recipes"
      ]
    },
  ];

  const GEMINI_API_KEY = "";
  const GEMINI_URL = ``;
  const IMAGE_GENERATION_API_KEY = "";
  const IMAGE_GENERATION_URL = "";

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  // Custom renderer for ReactMarkdown to handle code blocks with syntax highlighting and copy button
  const components = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const textToCopy = String(children).replace(/\n$/, '');

      const copyToClipboard = () => {
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            console.log('Code copied to clipboard');
          })
          .catch(err => {
            console.error('Failed to copy code: ', err);
          });
      };

      return !inline && match ? (
        <div className="code-block-container">
          <div className="code-block-header">
            <span className="code-language">{match[1]}</span>
            <button className="copy-code-btn" onClick={copyToClipboard} title="Copy code">
              <i className="far fa-copy"></i>
            </button>
          </div>
          <SyntaxHighlighter
            style={darkMode ? atomDark : solarizedlight}
            language={match[1]}
            PreTag="div"
            {...props}
          >
            {textToCopy}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  // Handle dark mode toggle
  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme) {
      setDarkMode(savedTheme === 'true');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }
  }, []);

  // Apply theme when dark mode changes
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Close theme menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target) &&
        !event.target.classList.contains('theme-toggle-btn')) {
        setShowThemeMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle clear chat area signal when a chat is deleted
  useEffect(() => {
    if (clearChatAreaSignal) {
      console.log("Clear chat area signal received, clearing messages");
      setMessages([]);
      setCurrentChatIndex(null);
      setSelectedImage(null);
      setImagePreview(null);
      resetClearChatAreaSignal();
    }
  }, [clearChatAreaSignal, resetClearChatAreaSignal]);

  // Auth state listener and load chat data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed, user:", currentUser?.email);
      if (currentUser) {
        setUser(currentUser);
        await loadChatData(currentUser.uid);
      } else {
        setUser(null);
        setMessages([]);
        setSelectedImage(null);
        setImagePreview(null);
        if (initialLoadCompletedRef.current) {
          setChatHistory([]);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Check scroll position and show/hide scroll button
  useEffect(() => {
    const checkScrollPosition = () => {
      if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100;
        setShowScrollButton(!isNearBottom);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      checkScrollPosition();
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScrollPosition);
      }
    };
  }, [messages]);

  // Load chat data from Firestore
  const loadChatData = async (uid) => {
    console.log("Loading chat data for user:", uid);
    try {
      const userDocRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Firestore data loaded:", data);

        if (data.chatHistory && Array.isArray(data.chatHistory) && data.chatHistory.length > 0) {
          const validChatHistory = data.chatHistory.filter(chat =>
            chat && (typeof chat === 'string' || chat.prompt || (chat.messages && chat.messages.length > 0))
          );

          console.log("Setting chat history from Firestore:", validChatHistory);
          setChatHistory(validChatHistory);

          if (validChatHistory.length > 0 && selectedChatIndex === null) {
            const firstChat = validChatHistory[0];
            if (typeof firstChat === 'string') {
              setMessages([{ type: 'user', content: firstChat }]);
            } else if (firstChat && firstChat.messages) {
              setMessages(firstChat.messages);
            }
            setCurrentChatIndex(0);
          }
        } else {
          console.log("No chat history found in Firestore, setting empty array");
          setChatHistory([]);
        }
      } else {
        console.log("User document doesn't exist, creating new one");
        await setDoc(userDocRef, { chatHistory: [] });
        setChatHistory([]);
      }

      dataLoadedRef.current = true;
      initialLoadCompletedRef.current = true;
    } catch (err) {
      console.error("Error loading chat data:", err);
      dataLoadedRef.current = true;
      initialLoadCompletedRef.current = true;
      setChatHistory([]);
    }
  };

  // Load selected chat when selectedChatIndex changes
  useEffect(() => {
    console.log("Selected chat index changed to:", selectedChatIndex);
    console.log("Current chat history:", chatHistory);

    if (selectedChatIndex !== undefined && selectedChatIndex !== null &&
      chatHistory && chatHistory.length > 0 && chatHistory[selectedChatIndex]) {
      setCurrentChatIndex(selectedChatIndex);

      const selectedChat = chatHistory[selectedChatIndex];
      if (typeof selectedChat === 'string') {
        setMessages([{ type: 'user', content: selectedChat }]);
      } else if (selectedChat && selectedChat.messages) {
        setMessages(selectedChat.messages);
      } else {
        setMessages([]);
      }
    }
  }, [selectedChatIndex, chatHistory]);

  // Migrate chat history to new format if needed
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0 && typeof chatHistory[0] === 'string') {
      console.log("Migrating chat history from old format to new format");
      const migratedHistory = chatHistory.map(chat => ({
        prompt: chat,
        messages: [{ type: 'user', content: chat }],
        timestamp: Date.now()
      }));
      setChatHistory(migratedHistory);
    }
  }, [chatHistory]);

  // Debounced save to Firestore
  useEffect(() => {
    if (user && dataLoadedRef.current && chatHistory) {
      const saveTimeout = setTimeout(() => {
        console.log("Saving chat history to Firestore:", chatHistory);

        const saveData = async () => {
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
              await updateDoc(userDocRef, {
                chatHistory: chatHistory
              });
            } else {
              await setDoc(userDocRef, {
                chatHistory: chatHistory
              });
            }
            console.log("Chat data saved successfully");
          } catch (err) {
            console.error("Error saving chat data:", err);
          }
        };

        saveData();
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [chatHistory, user]);

  // Handle new chat signal
  useEffect(() => {
    if (newChatSignal) {
      console.log("New chat signal received, clearing messages");
      setMessages([]);
      setCurrentChatIndex(null);
      setSelectedImage(null);
      setImagePreview(null);
      resetNewChatSignal();
    }
  }, [newChatSignal, resetNewChatSignal]);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const scrollToBottom = (behavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: behavior
      });
    }
  };

  const handleScrollButtonClick = () => {
    scrollToBottom();
  };

  useEffect(() => {
    if (messages.length > 0) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        scrollToBottom('auto');
      }, 100);
    }
  }, [messages]);

  const simulateTyping = async (text, userMsg) => {
    partialResponseRef.current = '';
    const botMessage = { type: 'bot', content: '' };
    setMessages(prevMessages => [...prevMessages, botMessage]);

    const blocks = parseContentBlocks(text);
    let currentDisplay = '';

    for (let i = 0; i < blocks.length; i++) {
      if (typingInterrupted.current) break;

      const block = blocks[i];

      if (block.type === 'code') {
        currentDisplay += block.openingFence;
        partialResponseRef.current = currentDisplay;
        updateBotMessage(currentDisplay);
        await delay(300);

        const codeLines = block.content.split('\n');
        for (let j = 0; j < codeLines.length; j++) {
          if (typingInterrupted.current) break;

          currentDisplay += (j > 0 ? '\n' : '') + codeLines[j];
          partialResponseRef.current = currentDisplay;
          updateBotMessage(currentDisplay);
          await delay(30);
        }

        currentDisplay += block.closingFence;
        partialResponseRef.current = currentDisplay;
        updateBotMessage(currentDisplay);
        await delay(300);
      }
      else if (block.type === 'paragraph') {
        const words = block.content.split(' ');
        const isShortParagraph = words.length < 15;

        for (let j = 0; j < words.length; j++) {
          if (typingInterrupted.current) break;

          currentDisplay += (j > 0 ? ' ' : '') + words[j];
          partialResponseRef.current = currentDisplay;
          updateBotMessage(currentDisplay);

          const endOfSentence = words[j].match(/[.!?]$/);

          if (endOfSentence) {
            await delay(isShortParagraph ? 200 : 100);
          } else if (j % 5 === 4) {
            await delay(isShortParagraph ? 100 : 50);
          } else {
            await delay(isShortParagraph ? 50 : 30);
          }
        }

        currentDisplay += '\n\n';
        partialResponseRef.current = currentDisplay;
        updateBotMessage(currentDisplay);
        await delay(300);
      }
      else if (block.type === 'list') {
        const listItems = block.content.split('\n');

        for (let j = 0; j < listItems.length; j++) {
          if (typingInterrupted.current) break;

          currentDisplay += (j > 0 ? '\n' : '') + listItems[j];
          partialResponseRef.current = currentDisplay;
          updateBotMessage(currentDisplay);
          await delay(150);
        }

        currentDisplay += '\n\n';
        partialResponseRef.current = currentDisplay;
        updateBotMessage(currentDisplay);
        await delay(300);
      }
      else if (block.type === 'header') {
        currentDisplay += block.content;
        partialResponseRef.current = currentDisplay;
        updateBotMessage(currentDisplay);
        currentDisplay += '\n\n';
        await delay(400);
      }
      else {
        currentDisplay += block.content;
        partialResponseRef.current = currentDisplay;
        updateBotMessage(currentDisplay);
        await delay(200);
      }
    }

    if (!typingInterrupted.current) {
      partialResponseRef.current = text;
      updateBotMessage(text);
    }

    return partialResponseRef.current;
  };

  const updateBotMessage = (content) => {
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1] = { type: 'bot', content };
      }
      return updated;
    });
  };

  const parseContentBlocks = (text) => {
    const blocks = [];
    const lines = text.split('\n');
    let currentBlock = { type: 'paragraph', content: '' };
    let inCodeBlock = false;
    let codeBlockFence = '';
    let codeBlockContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codeBlockMatch = line.match(/^(```\w*|~~~\w*)$/);

      if (codeBlockMatch && !inCodeBlock) {
        if (currentBlock.content) {
          blocks.push(currentBlock);
        }

        inCodeBlock = true;
        codeBlockFence = codeBlockMatch[1];
        codeBlockContent = '';
        continue;
      }

      if (line === '```' && inCodeBlock) {
        blocks.push({
          type: 'code',
          openingFence: codeBlockFence + '\n',
          content: codeBlockContent.trim(),
          closingFence: '\n```'
        });

        inCodeBlock = false;
        currentBlock = { type: 'paragraph', content: '' };
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += (codeBlockContent ? '\n' : '') + line;
        continue;
      }

      if (line.match(/^#{1,6}\s+/)) {
        if (currentBlock.content) {
          blocks.push(currentBlock);
        }

        blocks.push({ type: 'header', content: line });
        currentBlock = { type: 'paragraph', content: '' };
        continue;
      }

      if (line.match(/^(-|\*|\+|\d+\.)\s+/)) {
        if (currentBlock.type !== 'list') {
          if (currentBlock.content) {
            blocks.push(currentBlock);
          }
          currentBlock = { type: 'list', content: line };
        } else {
          currentBlock.content += '\n' + line;
        }
        continue;
      }

      if (line.trim() === '') {
        if (currentBlock.content) {
          blocks.push(currentBlock);
          currentBlock = { type: 'paragraph', content: '' };
        }
        continue;
      }

      if (currentBlock.type !== 'paragraph') {
        blocks.push(currentBlock);
        currentBlock = { type: 'paragraph', content: line };
      } else {
        if (currentBlock.content) {
          currentBlock.content += ' ' + line;
        } else {
          currentBlock.content = line;
        }
      }
    }

    if (currentBlock.content) {
      blocks.push(currentBlock);
    }

    return blocks;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      alert('Please select an image file (JPEG, PNG, GIF, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadImage = (imageUrl, prompt) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    // Create a safe filename from the prompt
    const safePrompt = prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    link.download = `generated-image-${safePrompt || Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateImage = async (prompt) => {
    setIsGeneratingImage(true);
    try {
      // Modify prompt to be more likely to pass content filters
      const safePrompt = `A safe, family-friendly image of ${prompt}. The image should be appropriate for all audiences and not contain any violence, adult content, or harmful material.`;
      
      const response = await fetch(IMAGE_GENERATION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${IMAGE_GENERATION_API_KEY}`
        },
        body: JSON.stringify({
          inputs: safePrompt,
          options: {
            wait_for_model: true,
            use_cache: false
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Image generation failed with status ${response.status}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Error generating image:", error);
      throw new Error(`Image generation failed: ${error.message}. Please try a different description.`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const sendPrompt = async (promptText = input) => {
    if (!promptText.trim() && !selectedImage) return;
    console.log("Sending prompt:", promptText);

    // Check if the prompt is requesting image generation
    const isImageGenerationRequest = promptText.toLowerCase().startsWith("generate image:") ||
      promptText.toLowerCase().startsWith("create image:") ||
      promptText.toLowerCase().startsWith("draw image:");

    // Clear input immediately
    setInput('');
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (apiTimeoutRef.current) {
      clearTimeout(apiTimeoutRef.current);
    }

    let userMsg;
    if (selectedImage) {
      userMsg = {
        type: 'user',
        content: promptText,
        image: imagePreview
      };
    } else {
      userMsg = { type: 'user', content: promptText };
    }

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    typingInterrupted.current = false;
    partialResponseRef.current = '';
    controllerRef.current = new AbortController();

    const newChatEntry = {
      prompt: promptText,
      messages: [...messages, userMsg],
      timestamp: Date.now()
    };

    let updatedHistory;
    let chatIndexToUse;

    if (currentChatIndex === null) {
      updatedHistory = [...(chatHistory || []), newChatEntry];
      chatIndexToUse = updatedHistory.length - 1;
    } else {
      updatedHistory = [...(chatHistory || [])];
      updatedHistory[currentChatIndex] = {
        ...updatedHistory[currentChatIndex],
        prompt: promptText,
        messages: [...messages, userMsg],
        timestamp: Date.now()
      };
      chatIndexToUse = currentChatIndex;
    }

    setChatHistory(updatedHistory);
    setCurrentChatIndex(chatIndexToUse);

    apiTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.log("API request timeout - aborting");
        stopResponse();
        setMessages((prev) => [
          ...prev,
          { type: 'bot', content: '❌ Request timed out. Please try again.' },
        ]);
      }
    }, 30000);

    try {
      if (isImageGenerationRequest) {
        // Extract the actual prompt for image generation
        const imagePrompt = promptText.replace(/^(generate|create|draw) image:\s*/i, '').trim();
        
        // Show a message that we're generating the image
        const generatingMsg = {
          type: 'bot',
          content: `Generating image for "${imagePrompt}"...`
        };
        setMessages(prev => [...prev, generatingMsg]);

        const imageUrl = await generateImage(imagePrompt);

        // Remove the "generating" message and add the actual image
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            type: 'bot',
            content: `Here's the generated image for "${imagePrompt}":`,
            image: imageUrl,
            imagePrompt: imagePrompt // Store the prompt for download filename
          }
        ]);

        // Update chat history with the image response
        updatedHistory = [...updatedHistory];
        updatedHistory[chatIndexToUse] = {
          ...updatedHistory[chatIndexToUse],
          messages: [
            ...messages,
            userMsg,
            {
              type: 'bot',
              content: `Here's the generated image for "${imagePrompt}":`,
              image: imageUrl,
              imagePrompt: imagePrompt
            }
          ]
        };
        setChatHistory(updatedHistory);
      } else {
        // Original text/chat processing
        let requestBody;

        if (selectedImage) {
          const reader = new FileReader();
          const base64Image = await new Promise((resolve) => {
            reader.onload = () => {
              const base64String = reader.result.split(',')[1];
              resolve(base64String);
            };
            reader.readAsDataURL(selectedImage);
          });

          requestBody = {
            contents: [{
              parts: [
                { text: promptText || "Describe this image" },
                {
                  inlineData: {
                    mimeType: selectedImage.type,
                    data: base64Image
                  }
                }
              ]
            }]
          };
        } else {
          requestBody = {
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
          };
        }

        const res = await fetch(GEMINI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controllerRef.current.signal,
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) throw new Error('Request failed with status ' + res.status);

        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (reply) {
          const finalResponse = await simulateTyping(reply, userMsg);

          if (apiTimeoutRef.current) {
            clearTimeout(apiTimeoutRef.current);
            apiTimeoutRef.current = null;
          }

          const currentMessages = [...messages, userMsg, { type: 'bot', content: finalResponse }];

          updatedHistory = [...updatedHistory];
          updatedHistory[chatIndexToUse] = {
            ...updatedHistory[chatIndexToUse],
            prompt: promptText,
            messages: currentMessages
          };

          setChatHistory(updatedHistory);
        } else {
          setMessages((prev) => [
            ...prev,
            { type: 'bot', content: '❌ Error: Invalid response from Gemini API.' },
          ]);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { type: 'bot', content: `❌ Error: ${error.message}` },
        ]);
        
        if (isImageGenerationRequest) {
          setMessages(prev => [
            ...prev,
            { 
              type: 'bot', 
              content: `You can try again with a modified description or ask for something else.` 
            }
          ]);
        }
      }
    } finally {
      if (apiTimeoutRef.current) {
        clearTimeout(apiTimeoutRef.current);
        apiTimeoutRef.current = null;
      }
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
    setTimeout(() => {
      setInput('');
      sendPrompt(suggestion);
    }, 0);
  };

  const stopResponse = () => {
    console.log("Stopping response generation");
    if (controllerRef.current) controllerRef.current.abort();
    typingInterrupted.current = true;
    setLoading(false);

    if (partialResponseRef.current && messages.length > 0) {
      const userMessages = messages.filter(msg => msg.type === 'user');
      const promptText = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';

      const lastBotIndex = messages.map(msg => msg.type).lastIndexOf('bot');

      if (lastBotIndex !== -1) {
        setMessages(prev => {
          const updated = [...prev];
          updated[lastBotIndex] = {
            type: 'bot',
            content: partialResponseRef.current
          };
          return updated;
        });

        setTimeout(() => {
          if (currentChatIndex !== null) {
            const updatedHistory = [...(chatHistory || [])];
            updatedHistory[currentChatIndex] = {
              ...updatedHistory[currentChatIndex],
              prompt: promptText,
              messages: messages.map((msg, idx) =>
                idx === lastBotIndex
                  ? { type: 'bot', content: partialResponseRef.current }
                  : msg
              )
            };
            setChatHistory(updatedHistory);
          }
        }, 50);
      }
    }
  };

  const handleMainButton = () => {
    loading ? stopResponse() : sendPrompt();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  };

  const handleVoiceInput = () => {
    if (!recognition) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    setIsListening(true);
    recognition.lang = 'en-US';
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      setTimeout(() => {
        setInput('');
        sendPrompt(transcript);
      }, 0);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  const handleSignup = async () => {
    const email = prompt('Enter email:');
    const password = prompt('Enter password (min 6 characters):');

    if (!email || !password) return;

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', userCred.user.uid), { chatHistory: [] });
      alert('✅ Sign Up successful');
    } catch (err) {
      alert(`❌ Sign Up failed: ${err.message}`);
    }
  };

  const handleLogin = async () => {
    const email = prompt('Enter email:');
    const password = prompt('Enter password:');

    if (!email || !password) return;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('✅ Login successful');
    } catch (err) {
      alert(`❌ Login failed: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setChatHistory([]);
      setMessages([]);
      setCurrentChatIndex(null);
      setSelectedImage(null);
      setImagePreview(null);
      alert('👋 Logged out successfully!');
    } catch (error) {
      console.error("Error during logout:", error);
      alert(`❌ Logout failed: ${error.message}`);
    }
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const toggleThemeMenu = () => {
    setShowThemeMenu(!showThemeMenu);
  };

  const showWelcomeTitle = messages.length === 0;

  return (
    <div className={`chat-area ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      <div className="auth-buttons">
        {user ? (
          <>
            <span className="user-info">👤 {user.email}</span>
            <button className="btn logout" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <button className="btn login" onClick={handleLogin}>Login</button>
            <button className="btn signup" onClick={handleSignup}>Sign Up</button>
          </>
        )}
      </div>

      {showWelcomeTitle && (
        <div className="welcome-container">
          <h1 className="chat-title">What can I help with?</h1>

          <div className="suggestion-cards">
            {suggestionCards.map((card, cardIndex) => (
              <div className="suggestion-card" key={cardIndex}>
                <div className="card-header">
                  <i className={card.icon}></i>
                  <h3>{card.title}</h3>
                </div>
                <ul className="suggestion-list">
                  {card.suggestions.map((suggestion, suggestionIndex) => (
                    <li
                      key={suggestionIndex}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="suggestion-item"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="chat-response-container" ref={containerRef}>
        <div ref={chatEndRef} />
        {showScrollButton && (
          <button
            className="scroll-to-bottom-btn"
            onClick={handleScrollButtonClick}
            title="Scroll to bottom"
          >
            <i className="fas fa-chevron-down"></i>
          </button>
        )}
        {loading && !isGeneratingImage && <p className="loading-msg">Generating...</p>}
        {isGeneratingImage && <p className="loading-msg">Generating image...</p>}
        {messages.slice().reverse().map((msg, index) => (
          <div
            key={index}
            className={`chat-message ${msg.type === 'user' ? 'user' : 'bot'} markdown-body`}
          >
            {msg.image && (
              <div className="image-preview-container">
                <img src={msg.image} alt={msg.content || "Generated content"} className="uploaded-image" />
                {msg.type === 'bot' && msg.image && (
                  <button
                    className="download-image-btn"
                    onClick={() => downloadImage(msg.image, msg.imagePrompt || msg.content)}
                    title="Download image"
                  >
                    <i className="fas fa-download"></i>
                  </button>
                )}
              </div>
            )}
            {msg.content && (
              <ReactMarkdown
                components={components}
                remarkPlugins={[remarkGfm]}
              >
                {msg.content}
              </ReactMarkdown>
            )}
          </div>
        ))}
      </div>

      <div className="chat-input-box">
        <div className="chat-input-inner">
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" className="preview-image" />
              <button className="remove-image-btn" onClick={removeImage}>
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}
          <textarea
            className="chat-input"
            placeholder="Ask anything or type 'generate image: [description]' to create images"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          ></textarea>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />

          <div className="chat-toolbar">
            <div className="left-tools">
              <button
                title="Add Image"
                className="tool-btn"
                onClick={() => fileInputRef.current.click()}
              >
                <i className="fas fa-image"></i>
              </button>
              <button className="tool-btn"><i className="fas fa-globe"></i> Search</button>
              <button className="tool-btn"><i className="fas fa-lightbulb"></i> Reason</button>
              <button
                className="tool-btn more-options-btn"
                onClick={toggleThemeMenu}
                title="More options"
              >
                <i className="fas fa-ellipsis-h"></i>
              </button>

              {showThemeMenu && (
                <div className="theme-menu" ref={themeMenuRef}>
                  <button
                    className="theme-toggle-option"
                    onClick={toggleTheme}
                  >
                    {darkMode ? (
                      <>
                        <i className="fas fa-sun theme-icon light-icon"></i>
                        <span>Light mode</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-moon theme-icon dark-icon"></i>
                        <span>Dark mode</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="right-tools">
              <button
                className={`tool-btn mic-btn ${isListening ? 'listening' : ''}`}
                onClick={handleVoiceInput}
                title="Speak"
              >
                <i className="fas fa-microphone"></i>
              </button>

              <button className="tool-btn send-btn" onClick={handleMainButton} title="Send">
                {loading ? <i className="fas fa-stop"></i> : <i className="fas fa-paper-plane"></i>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatArea;