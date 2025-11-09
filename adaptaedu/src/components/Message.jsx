import React, { useState, useEffect } from 'react';
import './Message.css';

function TypewriterText({ text, speed = 50, onContentChange }) {
    const [displayedLines, setDisplayedLines] = useState([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    const lines = text.split('\n');

    useEffect(() => {
        if (isComplete) return;

        if (currentLineIndex >= lines.length) {
            setIsComplete(true);
            return;
        }

        const currentLine = lines[currentLineIndex];

        if (currentCharIndex < currentLine.length) {
            const timer = setTimeout(() => {
                setCurrentCharIndex(prev => prev + 1);
            }, speed);
            return () => clearTimeout(timer);
        } else {
            setDisplayedLines(prev => [...prev, currentLine]);
            setCurrentLineIndex(prev => prev + 1);
            setCurrentCharIndex(0);
        }
    }, [currentCharIndex, currentLineIndex, lines, speed, isComplete]);

    useEffect(() => {
        if (onContentChange && !isComplete) {
            onContentChange();
        }
    }, [currentCharIndex, currentLineIndex, displayedLines, onContentChange, isComplete]);

    const formatText = (text) => {
        if (!text) return '';

        // Primeiro, protege as tags HTML existentes
        let processedText = text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Aplica a formatação Markdown
        processedText = processedText
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

        return processedText;
    };

    const handleClick = () => {
        if (!isComplete) {
            setDisplayedLines(lines);
            setIsComplete(true);
            if (onContentChange) {
                onContentChange();
            }
        }
    };

    return (
        <div onClick={handleClick} style={{ cursor: isComplete ? 'default' : 'pointer' }}>
            {displayedLines.map((line, index) => (
                <div
                    key={index}
                    style={{ 
                        opacity: index === displayedLines.length - 1 ? 1 : 0.7,
                        marginBottom: line === '' ? '0.5em' : '0'
                    }}
                    dangerouslySetInnerHTML={{ __html: formatText(line) || '<br/>' }}
                />
            ))}
            {!isComplete && currentLineIndex < lines.length && (
                <div style={{ opacity: 1 }} dangerouslySetInnerHTML={{
                    __html: formatText(lines[currentLineIndex].substring(0, currentCharIndex)) + '<span style="opacity: 0.5">|</span>'
                }} />
            )}
        </div>
    );
}

function Message({ role, content, sources, fontes, onOpenContent, onScrollNeeded, userName }) {
    const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);

    const formatText = (text) => {
        if (!text) return '';
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    };

    const handleContentClick = (source) => {
        if (onOpenContent && source) {
            onOpenContent({
                tipo: source.tipo || 'texto',
                nome: source.nome,
                conteudo: source.conteudo,
                url: source.url
            });
        }
    };

    const toggleSources = () => {
        setIsSourcesExpanded(prev => !prev);
    };

    // Agrupar fontes por arquivo
    const groupedFontes = () => {
        if (!fontes || fontes.length === 0) return [];

        const grupos = {};

        fontes.forEach((fonte, index) => {
            const referencia = fonte.metadata?.referencia_completa || fonte.metadata?.fonte || 'Fonte desconhecida';

            if (!grupos[referencia]) {
                grupos[referencia] = [];
            }
            grupos[referencia].push(index + 1);
        });

        return Object.entries(grupos).map(([arquivo, indices]) => ({
            arquivo,
            fontes: indices
        }));
    };

    return (
        <div className={`message ${role}`}>
            <div className="message-left">
                {role === 'assistant' ? (
                    <div className="message-avatar">
                        <img src="./edu.png" alt="EDO AI" />
                    </div>
                ) : (
                    <div className="user-avatar">{userName}</div>
                )}

                {role === 'assistant' && sources && sources.length > 0 && (
                    <button
                        className="sources-toggle"
                        onClick={toggleSources}
                        aria-label={isSourcesExpanded ? "Ocultar materiais" : "Mostrar materiais"}
                    >
                        <span className="sources-icon">📚</span>
                    </button>
                )}
            </div>

            <div className="message-bubble">
                <div className="message-content">
                    {role === 'assistant' ? (
                        <TypewriterText
                            text={content}
                            speed={30}
                            onContentChange={onScrollNeeded}
                        />
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: formatText(content) }} />
                    )}
                </div>

                {role === 'assistant' && sources && sources.length > 0 && isSourcesExpanded && (
                    <div className="message-sources">
                        <div className="sources-header">
                            <span className="sources-icon">📚</span>
                            <span className="sources-title">Materiais disponíveis</span>
                        </div>

                        <div className="inner-sources">
                            {fontes && fontes.length > 0 && (
                                <div className="sources-references">
                                    <div className="references-title">Referências citadas:</div>
                                    {groupedFontes().map((grupo, idx) => (
                                        <div key={idx} className="reference-item">
                                            <span className="reference-sources">
                                                {grupo.fontes.length === 1
                                                    ? `Fonte ${grupo.fontes[0]}`
                                                    : `Fontes ${grupo.fontes.join(', ')}`}
                                            </span>
                                            <span className="reference-file">({grupo.arquivo})</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="sources-list">
                                {sources.map((doc, index) => (
                                    <button
                                        key={index}
                                        className={`source-item source-${doc.tipo || 'texto'}`}
                                        onClick={() => handleContentClick(doc)}
                                        title={`Clique para abrir: ${doc.nome}`}
                                    >
                                        <span className="source-icon">
                                            {doc.tipo === 'pdf' ? '📄' :
                                                doc.tipo === 'video' ? '🎥' :
                                                    doc.tipo === 'imagem' ? '🖼️' :
                                                        doc.tipo === 'audio' ? '🎵' : '📄'}
                                        </span>
                                        <span className="source-name">{doc.nome}</span>
                                        <span className="source-arrow">→</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Message;