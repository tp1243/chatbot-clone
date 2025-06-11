import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import { auth } from './components/firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [chatHistory, setChatHistory] = useState([]);
  const [newChatSignal, setNewChatSignal] = useState(false);
  const [selectedChatIndex, setSelectedChatIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [clearChatAreaSignal, setClearChatAreaSignal] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    console.log("Setting up auth state listener in App.js");
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Custom function to handle chat deletion
  const handleDeleteChat = (indexToDelete) => {
    // Check if the deleted chat is the currently selected one
    if (selectedChatIndex === indexToDelete) {
      // Signal ChatArea to clear messages
      setClearChatAreaSignal(true);
      // Reset selected index
      setSelectedChatIndex(null);
    } else if (selectedChatIndex > indexToDelete) {
      // If the deleted chat was before the selected one, adjust the index
      setSelectedChatIndex(selectedChatIndex - 1);
    }
    
    // Update chat history by filtering out the deleted chat
    const updatedChats = chatHistory.filter((_, index) => index !== indexToDelete);
    setChatHistory(updatedChats);
  };

  const resetClearChatAreaSignal = () => {
    setClearChatAreaSignal(false);
  };

  const handleNewChat = () => {
    console.log("New chat requested");
    setNewChatSignal(true);
    setSelectedChatIndex(null);
  };

  const resetNewChatSignal = () => setNewChatSignal(false);

  const handleSelectChat = (index) => {
    console.log("Selected chat index:", index);
    setSelectedChatIndex(index);
  };

  // This prevents flash of empty content during authentication
  if (isLoading) {
    return <div className="loading-app">Loading...</div>;
  }

  return (
    <div className="app">
      <Sidebar
        chatHistory={chatHistory}
        setChatHistory={setChatHistory}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        activeChatIndex={selectedChatIndex} // Pass the selected chat index as the active chat index
      />

      <ChatArea
        chatHistory={chatHistory}
        setChatHistory={setChatHistory}
        newChatSignal={newChatSignal}
        resetNewChatSignal={resetNewChatSignal}
        selectedChatIndex={selectedChatIndex}
        clearChatAreaSignal={clearChatAreaSignal}
        resetClearChatAreaSignal={resetClearChatAreaSignal}
      />
    </div>
  );
}

export default App;