export interface Env {
    DAYTONA_API_KEY: string;
}

const HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Daytona Runner</title>
    <link rel="stylesheet" data-name="vs/editor/editor.main" href="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/xterm/5.3.0/xterm.min.css">
    
    <style>
        body { margin: 0; background: #1e1e1e; color: #ccc; font-family: 'Segoe UI', sans-serif; height: 100vh; display: flex; flex-direction: column; }
        header { padding: 10px 20px; background: #252526; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
        h1 { margin: 0; font-size: 16px; font-weight: 600; }
        .controls { display: flex; gap: 10px; }
        #main { display: flex; flex: 1; overflow: hidden; }
        #editor-container { flex: 1; }
        #terminal-container { flex: 1; background: #1e1e1e; padding: 10px; border-left: 1px solid #333; overflow: hidden; }
        
        button { 
            background: #0e639c; color: white; border: none; padding: 6px 16px; cursor: pointer; border-radius: 2px; 
            font-size: 14px; transition: background 0.2s;
        }
        button:hover { background: #1177bb; }
        button:disabled { background: #444; cursor: not-allowed; color: #888; }
        select { background: #3c3c3c; color: white; border: 1px solid #333; padding: 5px; border-radius: 2px; }
    </style>
</head>
<body>

<header>
    <h1>PyRunner</h1>
    <div class="controls">
        <select id="mode">
            <option value="local">Local (Browser)</option>
            <option value="cloud">Cloud (Daytona)</option>
        </select>
        <button id="run-btn" onclick="run()" disabled>Loading...</button>
    </div>
</header>

<div id="main">
    <div id="editor-container"></div>
    <div id="terminal-container"></div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xterm/5.3.0/xterm.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xterm/5.3.0/addon-fit/addon-fit.min.js"></script>
<script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>

<script>
    let editor = null;
    let term = null;
    let pyodide = null;
    const runBtn = document.getElementById('run-btn');

    // 1. Initialize Terminal
    term = new Terminal({ 
        theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
        fontSize: 14,
        fontFamily: 'Consolas, monospace'
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal-container'));
    fitAddon.fit();
    window.addEventListener('resize', () => fitAddon.fit());

    term.writeln('\\x1b[34m[System] Initializing environment...\\x1b[0m');

    // 2. Initialize Monaco Editor
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    
    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: [
                'import sys',
                'print(f"Hello from {sys.platform}!")',
                'print("This code is running instantly.")'
            ].join('\\n'),
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true
        });
        checkReady();
    });

    // 3. Initialize Pyodide
    async function loadPyodideEnv() {
        try {
            pyodide = await loadPyodide();
            // Redirect stdout to xterm
            pyodide.setStdout({ batched: (msg) => term.writeln(msg) });
            pyodide.setStderr({ batched: (msg) => term.writeln('\\x1b[31m' + msg + '\\x1b[0m') });
            checkReady();
        } catch (err) {
            term.writeln('\\x1b[31m[Error] Failed to load Pyodide: ' + err + '\\x1b[0m');
        }
    }
    loadPyodideEnv();

    // 4. Enable Button when both are ready
    function checkReady() {
        if (editor && pyodide) {
            runBtn.disabled = false;
            runBtn.innerText = '▶ Run';
            term.writeln('\\x1b[32m[System] Ready. Click Run to start.\\x1b[0m\\r\\n');
        }
    }

    // 5. Run Function
    async function run() {
        if (!editor) { alert("Editor not loaded yet."); return; }
        
        const code = editor.getValue();
        const mode = document.getElementById('mode').value;
        
        term.reset(); // Clear terminal

        if (mode === 'local') {
            term.writeln('\\x1b[34m[Local] Running...\\x1b[0m\\r\\n');
            try {
                await pyodide.runPythonAsync(code);
            } catch (err) {
                term.writeln('\\x1b[31m' + err + '\\x1b[0m');
            }
        } else {
            term.writeln('\\x1b[35m[Cloud] Connecting to Daytona...\\x1b[0m');
            
            try {
                const response = await fetch('/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error('Server Error: ' + errText);
                }
                
                const data = await response.json();
                
                // Clear "Connecting" message
                term.reset();
                term.writeln('\\x1b[35m[Cloud] Output:\\x1b[0m\\r\\n');
                
                if (data.result) term.write(data.result); // Use write for raw output (preserves newlines)
                if (data.error) term.writeln('\\x1b[31m' + data.error + '\\x1b[0m');
                
            } catch (err) {
                term.writeln('\\x1b[31m[Error] ' + err.message + '\\x1b[0m');
            }
        }
        term.writeln('\\r\\n\\x1b[2m>>> Done\\x1b[0m');
    }
</script>
</body>
</html>
`;

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Serve HTML
        if (request.method === "GET") {
            return new Response(HTML, { headers: { "Content-Type": "text/html" } });
        }

        // Handle Execution
        if (url.pathname === "/run" && request.method === "POST") {
            try {
                const { code } = await request.json() as { code: string };
                if (!code) return new Response("No code provided", { status: 400 });

                // 1. Create Sandbox
                const createRes = await fetch("https://app.daytona.io/api/sandbox", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${env.DAYTONA_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ language: "python", autoDeleteInterval: 1 })
                });

                if (!createRes.ok) throw new Error(`Create Sandbox Failed: ${await createRes.text()}`);
                
                const sandbox = await createRes.json() as { id: string };
                const sandboxId = sandbox.id;

                // 2. Execute Code
                // We escape double quotes to safely echo it into a file
                const escapedCode = code.replace(/"/g, '\\"');
                const command = `echo "${escapedCode}" > main.py && python3 main.py`;

                const execRes = await fetch(`https://app.daytona.io/api/sandbox/${sandboxId}/process/execute`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${env.DAYTONA_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ command })
                });

                // 3. Cleanup (Async)
                ctx.waitUntil(
                    fetch(`https://app.daytona.io/api/sandbox/${sandboxId}`, {
                        method: "DELETE",
                        headers: { "Authorization": `Bearer ${env.DAYTONA_API_KEY}` }
                    })
                );

                if (!execRes.ok) throw new Error(`Execution Failed: ${await execRes.text()}`);

                const output = await execRes.json();
                return new Response(JSON.stringify(output), {
                    headers: { "Content-Type": "application/json" }
                });

            } catch (error) {
                return new Response(JSON.stringify({ error: (error as Error).message }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        return new Response("Not Found", { status: 404 });
    }
};