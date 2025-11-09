import React, { useState, useRef, useEffect } from 'react';
import './ChatInput.css';

function ChatInput({ onSendMessage, disabled }) {
    const [message, setMessage] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [message]);

    const handleSubmit = () => {
        const trimmedMessage = message.trim();
        if (trimmedMessage && !disabled) {
            onSendMessage(trimmedMessage);
            setMessage('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className={`chat-input-container ${isFocused ? 'focused' : ''}`}>
            <div className="input-wrapper">
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Digite sua mensagem..."
                    rows="1"
                    disabled={disabled}
                    className="message-input"
                />
                <div className="input-actions">
                    <button 
                        className="btn-send" 
                        onClick={handleSubmit}
                        disabled={disabled || !message.trim()}
                    >
                        <span className="send-icon">↑</span>
                    </button>
                </div>
            </div>
            <div className="input-hint">
                Pressione <kbd>Enter</kbd> para enviar, <kbd>Shift + Enter</kbd> para nova linha
            </div>
        </div>
    );
}

export default ChatInput;