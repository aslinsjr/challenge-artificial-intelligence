import React, { useState } from 'react';
import Home from './Home.jsx';
import Chat from './Chat.jsx';
import './App.css';

function App() {
    const [currentPage, setCurrentPage] = useState('home');

    const handleStartChat = () => {
        setCurrentPage('chat');
    };

    const handleBackToHome = () => {
        setCurrentPage('home');
    };

    return (
        <div className="app-container">
            {currentPage === 'home' ? (
                <Home onStartChat={handleStartChat} />
            ) : (
                <Chat onBackToHome={handleBackToHome} />
            )}
        </div>
    );
}

export default App;