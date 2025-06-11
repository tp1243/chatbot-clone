import React from 'react';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <span className="logo">ChatGPT UI</span>
      </div>
      <div className="navbar-right">
        <button className="nav-btn login">Login</button>
        <button className="nav-btn signup">Sign Up</button>
      </div>
    </nav>
  );
}

export default Navbar;
