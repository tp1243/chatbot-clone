import React, { useState } from 'react';
import './ChatBot.css';

function ChatBot() {
  const [messages, setMessages] = useState([
    { text: "Hi! I'm your chatbot. Ask me anything!", sender: "bot" },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: 'user' };
    setMessages([...messages, userMessage]);

    // Dummy bot reply
    const botReply = { text: `You said: "${input}"`, sender: 'bot' };
    setTimeout(() => {
      setMessages(prev => [...prev, botReply]);
    }, 500);

    setInput('');
  };

  return (
    <div className="chatbot-container">
      <div className="chat-box">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
      </div>
      <div className="input-box">
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

export default ChatBot;
