const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());


app.use('/', require('./routes/parking'));


app.listen(port, () => {
    console.log(`Listening to port ${port}`);
});

