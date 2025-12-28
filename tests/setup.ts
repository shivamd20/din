import { spawn } from 'child_process';

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let devServer: ReturnType<typeof spawn> | null = null;
let SERVER_PORT = 8787;
const SERVER_READY_TIMEOUT = 60000; // 60 seconds

function getServerUrl(): string {
    return `http://localhost:${SERVER_PORT}`;
}

export async function startDevServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log('Starting dev server...');
        devServer = spawn('npm', ['run', 'dev'], {
            stdio: 'pipe',
            shell: true,
            env: { ...process.env }
        });

        let resolved = false;
        
        const checkServer = async () => {
            // Try common wrangler ports
            const portsToTry = [8787, 8790, 8788, 8789];
            
            for (let attempt = 0; attempt < 60; attempt++) {
                for (const port of portsToTry) {
                    try {
                        const url = `http://localhost:${port}`;
                        const response = await fetch(url);
                        if (response.ok || response.status === 401 || response.status === 404) {
                            // Server is responding (401/404 is expected)
                            if (!resolved) {
                                SERVER_PORT = port;
                                resolved = true;
                                console.log(`Server is responding on port ${port}!`);
                                resolve();
                            }
                            return;
                        }
                    } catch {
                        // Server not ready on this port yet
                    }
                }
                await delay(1000);
            }
            if (!resolved) {
                reject(new Error('Server failed to start within timeout'));
            }
        };

        devServer.stdout?.on('data', (data: Buffer) => {
            const output = data.toString();
            process.stdout.write(output);
            
            // Try to extract port from output (e.g., "Ready on http://localhost:8787")
            const portMatch = output.match(/localhost:(\d+)/);
            if (portMatch) {
                const detectedPort = parseInt(portMatch[1], 10);
                if (detectedPort && SERVER_PORT !== detectedPort) {
                    SERVER_PORT = detectedPort;
                    console.log(`Detected server port: ${SERVER_PORT}`);
                }
            }
            
            // Check if server is ready
            if ((output.includes('Ready') || output.includes('Listening') || output.includes('Local:')) && !resolved) {
                resolved = true;
                console.log('Server is ready!');
                resolve();
            }
        });

        devServer.stderr?.on('data', (data: Buffer) => {
            const output = data.toString();
            process.stderr.write(output);
        });

        devServer.on('error', (error) => {
            console.error('Failed to start server:', error);
            if (!resolved) {
                resolved = true;
                reject(error);
            }
        });

        // Start checking server after a short delay
        delay(3000).then(() => checkServer());

        // Final timeout
        delay(SERVER_READY_TIMEOUT).then(() => {
            if (!resolved && devServer && !devServer.killed) {
                resolved = true;
                reject(new Error('Server failed to start within timeout'));
            }
        });
    });
}

export async function stopDevServer(): Promise<void> {
    if (devServer) {
        console.log('Stopping dev server...');
        devServer.kill('SIGTERM');
        devServer = null;
        await delay(2000); // Give it time to shut down
    }
}

export { getServerUrl };

// Global setup and teardown for vitest
export async function setup() {
    console.log('Global setup: Starting dev server...');
    await startDevServer();
    // Wait a bit more for everything to be ready
    await delay(2000);
    console.log('Global setup: Dev server ready!');
}

export async function teardown() {
    console.log('Global teardown: Stopping dev server...');
    await stopDevServer();
    console.log('Global teardown: Dev server stopped!');
}

export { delay };

