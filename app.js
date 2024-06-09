const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { startBot } = require('./bot');

const app = express();
const upload = multer({ dest: 'proxy_lists/' });

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/start', upload.single('proxy_file'), (req, res) => {
    const url = req.body.url;
    const proxyFilePath = req.file.path;

    if (url && proxyFilePath) {
        console.log(`Starting bot for URL: ${url} with proxy file: ${proxyFilePath}`);
        startBot(url, proxyFilePath)
            .then(() => {
                res.send('Bot started successfully!');
            })
            .catch((err) => {
                console.error(err);
                res.status(500).send('Failed to start bot.');
            });
    } else {
        res.status(400).send('Missing URL or proxy file.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
