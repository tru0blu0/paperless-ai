const fs = require('fs');
const util = require('util');
const path = require('path');

class Logger {
    constructor(options = {}) {
        this.logFile = options.logFile || 'application.log';
        this.logDir = options.logDir || 'logs';
        this.timestamp = options.timestamp !== false;
        this.format = options.format || 'txt';
        this.maxFileSize = options.maxFileSize || 1024 * 1024 * 10; // Standard: 10MB
        this.htmlHeader = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Application Logs</title>
    <style>
        body {
            background-color: #1e1e1e;
            color: #ffffff;
            font-family: 'Consolas', 'Monaco', monospace;
            padding: 20px;
            margin: 0;
        }
        .log-container {
            background-color: #2d2d2d;
            border-radius: 5px;
            padding: 10px;
            max-width: 100%;
            overflow-x: auto;
        }
        .log-entry {
            padding: 3px 5px;
            margin: 2px 0;
            border-radius: 3px;
            white-space: pre-wrap;
        }
        .timestamp {
            color: #888888;
        }
        .type {
            font-weight: bold;
            margin: 0 5px;
        }
        .type-info { color: #4CAF50; }
        .type-error { color: #f44336; }
        .type-warn { color: #ff9800; }
        .type-debug { color: #2196F3; }
        .message { margin-left: 5px; }
        .auto-scroll {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #333;
            border: none;
            color: white;
            padding: 10px;
            border-radius: 5px;
            cursor: pointer;
        }
        .auto-scroll:hover {
            background: #444;
        }
    </style>
    <script>
        let autoScroll = true;
        function toggleAutoScroll() {
            autoScroll = !autoScroll;
            document.getElementById('autoScrollBtn').textContent = 
                autoScroll ? 'Auto-Scroll: ON' : 'Auto-Scroll: OFF';
        }
        function scrollToBottom() {
            if (autoScroll) {
                window.scrollTo(0, document.body.scrollHeight);
            }
        }
        const observer = new MutationObserver(scrollToBottom);
        window.onload = () => {
            observer.observe(document.querySelector('.log-container'), 
                { childList: true });
            scrollToBottom();
        };
    </script>
</head>
<body>
    <div class="log-container">
`;
        this.htmlFooter = `    </div>
    <button class="auto-scroll" id="autoScrollBtn" onclick="toggleAutoScroll()">
        Auto-Scroll: ON
    </button>
</body>
</html>`;

        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        this.logPath = path.join(this.logDir, this.logFile);

        // Initialisiere Log-Datei
        this.initLogFile();

        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };

        this.overrideConsoleMethods();
    }

    initLogFile() {
        try {
            // Prüfe ob die Datei die maximale Größe überschreitet
            if (this.checkFileSize()) {
                // Lösche die alte Datei
                fs.unlinkSync(this.logPath);
            }
        } catch (error) {
            console.warn(`[WARNING] Error during log file initialization (deletion): ${error.message}`);
        }

        // Initialisiere HTML-Datei wenn nötig
        if (this.format === 'html') {
            this.initHtmlFile();
        }
    }

    checkFileSize() {
        try {
            if (fs.existsSync(this.logPath)) {
                const stats = fs.statSync(this.logPath);
                return stats.size >= this.maxFileSize;
            }
            return false;
        } catch (error) {
            console.error(`[ERROR] Error checking file size: ${error.message}`);
            return false;
        }
    }

    initHtmlFile() {
        try {
            if (!fs.existsSync(this.logPath) || fs.statSync(this.logPath).size === 0) {
                fs.writeFileSync(this.logPath, this.htmlHeader);
            }
        } catch (error) {
            console.error(`[ERROR] Error initializing HTML file: ${error.message}`);
        }
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    formatLogMessage(type, args) {
        const msg = util.format(...args);
        if (this.format === 'html') {
            const timestamp = this.timestamp ?
                `<span class="timestamp">[${this.getTimestamp()}]</span>` : '';
            return `    <div class="log-entry">
        ${timestamp}
        <span class="type type-${type}">[${type.toUpperCase()}]</span>
        <span class="message">${this.escapeHtml(msg)}</span>
    </div>\n`;
        } else {
            return this.timestamp ?
                `[${this.getTimestamp()}] [${type.toUpperCase()}] ${msg}\n` :
                `[${type.toUpperCase()}] ${msg}\n`;
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">")
            .replace(/"/g, """)
            .replace(/'/g, "'")
            .replace(/\n/g, "<br>")
            .replace(/\s/g, " ");
    }

    writeToFile(message) {
        try {
            // Prüfe Dateigröße vor dem Schreiben
            if (this.checkFileSize()) {
                // Lösche die alte Datei
                fs.unlinkSync(this.logPath);

                // Bei HTML-Format müssen wir den Header neu schreiben
                if (this.format === 'html') {
                    this.initHtmlFile();
                }
            }

            fs.appendFileSync(this.logPath, message);
        } catch (error) {
            console.error(`[ERROR] Error writing to log file: ${error.message}`);
        }
    }

    overrideConsoleMethods() {
        console.log = (...args) => {
            const logMessage = this.formatLogMessage('info', args);
            this.originalConsole.log(...args);
            this.writeToFile(logMessage);
        };

        console.error = (...args) => {
            const logMessage = this.formatLogMessage('error', args);
            this.originalConsole.error(...args);
            this.writeToFile(logMessage);
        };

        console.warn = (...args) => {
            const logMessage = this.formatLogMessage('warn', args);
            this.originalConsole.warn(...args);
            this.writeToFile(logMessage);
        };

        console.info = (...args) => {
            const logMessage = this.formatLogMessage('info', args);
            this.originalConsole.info(...args);
            this.writeToFile(logMessage);
        };

        console.debug = (...args) => {
            const logMessage = this.formatLogMessage('debug', args);
            this.originalConsole.debug(...args);
            this.writeToFile(logMessage);
        };
    }

    closeHtmlFile() {
        if (this.format === 'html') {
            try {
                this.writeToFile(this.htmlFooter);
            } catch (error) {
                console.error(`[ERROR] Error closing HTML file: ${error.message}`);
            }
        }
    }

    restore() {
        Object.assign(console, this.originalConsole);
        if (this.format === 'html') {
            this.closeHtmlFile();
        }
    }
}

module.exports = Logger;
