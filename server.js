const express = require('express');
const os = require('os');
const { networkInterfaces } = require('os');
const { exec } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const port = 5000;

function getNetworkInfo() {
    const nets = networkInterfaces();
    let results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    return results;
}

app.all('/system-info', (req, res) => {
    try {
        const cpuUsage = os.loadavg()[0]; // 1 minute load average
        const freeMemory = os.freemem();
        const totalMemory = os.totalmem();
        const usedMemory = totalMemory - freeMemory;
        const networkInfo = getNetworkInfo();

        res.json({
            cpuUsage,
            usedMemory,
            freeMemory,
            totalMemory,
            networkInfo
        });
    } catch (error) {
        console.error('Error fetching system info:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/start-terminal', (req, res) => {
    const { streamInfo } = req.body; // Payload with stream info
    console.log("stream", streamInfo)

    try {
        const batchFilePath = path.join(__dirname, 'logStreamInfo.bat');

        // Create a batch file with the necessary logging commands
        const batchFileContent = `
@echo off
echo AgroCast Terminal Started
echo Stream Information:
echo Resolution: ${streamInfo?.resolution}
echo Bitrate: ${streamInfo?.bitrate} kbps
echo Codec: ${streamInfo?.codec}
echo Audio Stream: ${streamInfo?.audioStream}
echo Frame Rate: ${streamInfo?.frameRate} fps
echo Transport Protocol: ${streamInfo?.transportProtocol}
echo Start Time: ${streamInfo?.startTime}
echo ================================
:loop
echo CPU Usage: ${os.loadavg()[0]}
echo Used Memory: ${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)} MB
echo Free Memory: ${Math.round(os.freemem() / 1024 / 1024)} MB
echo Total Memory: ${Math.round(os.totalmem() / 1024 / 1024)} MB
for /f "tokens=1,* delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do echo Network Info: %%b
echo ================================
timeout /t 1 >nul
goto loop
        `;

        fs.writeFileSync(batchFilePath, batchFileContent);

        // Execute the batch file in a new terminal window
        exec(`start cmd.exe /K "${batchFilePath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return res.status(500).send('Error opening terminal');
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            console.log(`stdout: ${stdout}`);
        });

        res.send('Terminal started and logging stream info');
    } catch (error) {
        console.error('Error starting terminal:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
