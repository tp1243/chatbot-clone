import React, { useState, useEffect } from 'react';
import { FiSidebar, FiSearch, FiEdit3, FiMessageCircle, FiTrash2 } from 'react-icons/fi';
import './Sidebar.css';
import { auth } from './firebase';

function Sidebar({ chatHistory, setChatHistory, onNewChat, onSelectChat, onDeleteChat, activeChatIndex }) {
  const [isOpen, setIsOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [groupedChats, setGroupedChats] = useState({
    today: [],
    yesterday: [],
    last7Days: [],
    older: []
  });

  // Check if viewport is mobile size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    
    if (window.innerWidth <= 768) {
      setIsOpen(false);
    }

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Group chats by date whenever chatHistory or searchTerm changes
  useEffect(() => {
    if (!Array.isArray(chatHistory)) {
      setGroupedChats({ today: [], yesterday: [], last7Days: [], older: [] });
      return;
    }

    // Get current date and time
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const last7DaysStart = new Date(todayStart);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);

    // Filter and group chats
    const groups = { today: [], yesterday: [], last7Days: [], older: [] };

    chatHistory.forEach((chat, index) => {
      if (!chat) return;

      let chatText;
      let timestamp;

      if (typeof chat === 'string') {
        chatText = chat;
        timestamp = Date.now();
      } else if (chat.prompt) {
        chatText = chat.prompt;
        timestamp = chat.timestamp || Date.now();
      } else {
        return;
      }

      // Skip if it doesn't match search
      if (searchTerm && !chatText.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }

      const chatDate = new Date(timestamp);
      
      // Determine which group this chat belongs to
      if (chatDate >= todayStart) {
        groups.today.push({ chat, index });
      } else if (chatDate >= yesterdayStart) {
        groups.yesterday.push({ chat, index });
      } else if (chatDate >= last7DaysStart) {
        groups.last7Days.push({ chat, index });
      } else {
        groups.older.push({ chat, index });
      }
    });

    setGroupedChats(groups);
  }, [chatHistory, searchTerm]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    
    if (isMobile) {
      document.body.style.overflow = !isOpen ? 'hidden' : 'auto';
    }
  };

  const deleteChat = (e, indexToDelete) => {
    e.stopPropagation();
    if (!Array.isArray(chatHistory)) return;
    onDeleteChat(indexToDelete);
  };

  const getChatText = (chat) => {
    if (!chat) return "Untitled Chat";

    if (typeof chat === 'string') {
      return chat;
    } else if (chat.prompt) {
      return chat.prompt;
    }
    return "Untitled Chat";
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: new Date().getFullYear() !== date.getFullYear() ? 'numeric' : undefined
    });
  };

  // Function to check if a chat is active
  const isActiveChat = (index) => {
    return index === activeChatIndex;
  };

  if (!user) {
    return (
      <div className="sidebar-container">
        <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
          <div className="top-icons">
            <div className="left-icon">
              <FiSidebar className="icon" onClick={toggleSidebar} title="Toggle Sidebar" />
            </div>
          </div>

          {isOpen && (
            <div className="login-prompt">
              <p>Please login to view your chats</p>
            </div>
          )}
        </div>
        {isOpen && isMobile && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
      </div>
    );
  }

  return (
    <div className="sidebar-container">
      <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="top-icons">
          <div className="left-icon">
            <FiSidebar className="icon" onClick={toggleSidebar} title="Toggle Sidebar" />
          </div>
          {isOpen && (
            <div className="right-icons">
              <FiSearch className="icon" title="Search" />
              <FiEdit3 className="icon" title="New Chat" onClick={onNewChat} />
            </div>
          )}
        </div>

        {isOpen && (
          <>
            <input
              type="text"
              placeholder="Search chats..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="chat-history-section">
              {/* TODAY SECTION */}
              {groupedChats.today.length > 0 && (
                <div className="date-section">
                  <h3 className="date-header">Today</h3>
                  <ul className="chat-history">
                    {groupedChats.today.map(({ chat, index }) => (
                      <li 
                        key={index}
                        className={`chat-item ${isActiveChat(index) ? 'active-chat' : ''}`}
                        onClick={() => onSelectChat(index)}
                      >
                        <span className="chat-text">{getChatText(chat)}</span>
                        <FiTrash2
                          className="delete-icon"
                          onClick={(e) => deleteChat(e, index)}
                          title="Delete chat"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* YESTERDAY SECTION */}
              {groupedChats.yesterday.length > 0 && (
                <div className="date-section">
                  <h3 className="date-header">Yesterday</h3>
                  <ul className="chat-history">
                    {groupedChats.yesterday.map(({ chat, index }) => (
                      <li 
                        key={index}
                        className={`chat-item ${isActiveChat(index) ? 'active-chat' : ''}`}
                        onClick={() => onSelectChat(index)}
                      >
                        <span className="chat-text">{getChatText(chat)}</span>
                        <FiTrash2
                          className="delete-icon"
                          onClick={(e) => deleteChat(e, index)}
                          title="Delete chat"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* LAST 7 DAYS SECTION */}
              {groupedChats.last7Days.length > 0 && (
                <div className="date-section">
                  <h3 className="date-header">Previous 7 Days</h3>
                  <ul className="chat-history">
                    {groupedChats.last7Days.map(({ chat, index }) => (
                      <li 
                        key={index}
                        className={`chat-item ${isActiveChat(index) ? 'active-chat' : ''}`}
                        onClick={() => onSelectChat(index)}
                      >
                        <span className="chat-text">{getChatText(chat)}</span>
                        <FiTrash2
                          className="delete-icon"
                          onClick={(e) => deleteChat(e, index)}
                          title="Delete chat"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* OLDER CHATS SECTION */}
              {groupedChats.older.length > 0 && (
                <div className="date-section">
                  <h3 className="date-header">Older</h3>
                  <ul className="chat-history">
                    {groupedChats.older.map(({ chat, index }) => (
                      <li 
                        key={index}
                        className={`chat-item ${isActiveChat(index) ? 'active-chat' : ''}`}
                        onClick={() => onSelectChat(index)}
                      >
                        <span className="chat-text">{getChatText(chat)}</span>
                        <FiTrash2
                          className="delete-icon"
                          onClick={(e) => deleteChat(e, index)}
                          title="Delete chat"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* NO CHATS MESSAGE */}
              {groupedChats.today.length === 0 &&
                groupedChats.yesterday.length === 0 &&
                groupedChats.last7Days.length === 0 &&
                groupedChats.older.length === 0 && (
                  <div className="no-history">No chats yet</div>
                )}
            </div>

            <div className="bottom-link">Upgrade plan</div>
          </>
        )}

        {!isOpen && (
          <ul className="chat-icons">
            {Array.isArray(chatHistory) && chatHistory.length > 0 ? (
              chatHistory.map((_, index) => (
                <li 
                  key={index}
                  className={`chat-icon ${isActiveChat(index) ? 'active-chat-icon' : ''}`}
                  onClick={() => onSelectChat(index)}
                >
                  <FiMessageCircle title={`Chat ${index + 1}`} />
                </li>
              ))
            ) : (
              <li className="no-history-icon">🗨️</li>
            )}
          </ul>
        )}
      </div>
      
      {isOpen && isMobile && (
        <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      )}
      
      {isMobile && !isOpen && (
        <div className="mobile-toggle-button" onClick={toggleSidebar}>
          <FiSidebar />
        </div>
      )}
    </div>
  );
}

export default Sidebar;