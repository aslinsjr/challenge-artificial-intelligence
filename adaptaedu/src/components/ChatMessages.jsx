// ChatMessages.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import Message from './Message.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import './ChatMessages.css';

function ChatMessages({ messages, isLoading, onSelectOption, onOpenContent , userName}) {
    const messagesEndRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, scrollToBottom]);

    return (
        <div className="chat-messages">
            {messages.map((msg, index) => {
    if (msg.role === 'assistant' && msg.data) {
        return (
            <Message
                key={index}
                role={msg.role}
                content={msg.data.resposta}
                sources={msg.data.documentos_usados}
                fontes={msg.data.fontes} 
                onOpenContent={onOpenContent}
                onScrollNeeded={scrollToBottom}
            />
        );
    }
    
    return (
        <Message
            key={index}
            role={msg.role}
            content={msg.content}
            userName={userName}
            onScrollNeeded={scrollToBottom}
        />
    );
})}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
        </div>
    );
}

export default ChatMessages;