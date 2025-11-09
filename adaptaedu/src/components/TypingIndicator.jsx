import React from 'react';
import './TypingIndicator.css';

function TypingIndicator() {
    return (
        <div className="message assistant">
            <div className="message-avatar">
                <img src="./edu.png" alt="EDU AI" />
            </div>
            <div className="typing-bubble">
                <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                </div>
            </div>
        </div>
    );
}

export default TypingIndicator;