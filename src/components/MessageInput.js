import React, { useState } from 'react';
import { FaMicrophone } from 'react-icons/fa';
import './MessageInput.css';

function MessageInput({ onSend }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  return (
    <div className="input-bar">
      <input
        type="text"
        placeholder="Ask anything"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
      />
      <button onClick={handleSend}><FaMicrophone /></button>
    </div>
  );
}

export default MessageInput;
