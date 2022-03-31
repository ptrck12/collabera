const express = require('express');
const router = express.Router();
const moment = require('moment');

let parking = {
    SP: [[{}]],
    MP: [[{}]],
    LP: [[{}]]
};

router.post('/setting', (req, res) => {
    try {
        const data = req.body;

        const areas = Object.keys(data);

        for (let i = 0; i < areas.length; i++) {
            while (parking[areas[i]].length < data[areas[i]].row) {
                parking[areas[i]].push([]);
            }
            for (x = 0; x < parking[areas[i]].length; x++) {
                while (parking[areas[i]][x].length < data[areas[i]].column) {
                    parking[areas[i]][x].push({});
                }
            }
        }

        res.status(200).send(parking);
    }
    catch (e) {
        res.status(500).send(e.message);
    }

})
router.post('/entry-point', (req, res) => {
    const entryPoints = req.body;
    let count = 0;

    try {
        // count entry points 
        for (i in parking) {
            parking[i].map(r => {
                count += r.filter(x => x.type == 'entry').length;
            });
        }
        if ((entryPoints.length + count) < 3) { // todo remove entry points which is already an entry point
            res.status(400).send('there should be at least 3 entry points');
        }
        else {
            while (entryPoints.length) {
                const { size, row, column } = entryPoints.shift();
                if (parking[size][row - 1][column - 1] == 'entry') {
                    throw new Error('All entry point should be distinct');
                }
                parking[size][row - 1][column - 1].type = 'entry';

            }
            res.status(200).send('success');
        }

    }
    catch (e) {
        res.status(400).send(e.message || 'Unable to set spot as an entry point');
    }
})

router.post('/', (req, res) => {
    const size = req.body.size.toLowerCase();
    const plate_no = req.body.plate_no;
    // find all entry points
    let entrypoints = [];
    for (let i in parking) {
        for (let x = 0; x < parking[i].length; x++) {
            for (let y = 0; y < parking[i][x].length; y++) {
                if (parking[i][x][y].type == 'entry') {
                    entrypoints.push({
                        area: i,
                        row: x + 1,
                        column: y + 1
                    });
                }
            }
        }
    }

    let choices = [];
    for (let i = 0; i < entrypoints.length; i++) {
        const { area, row, column } = entrypoints[i];
        for (let parkingArea in parking) {
            for (let x = 0; x < parking[parkingArea].length; x++) {
                for (y = 0; y < parking[parkingArea][x].length; y++) {
                    if (parking[parkingArea][x][y].type) {
                        continue;
                    }
                    let step = 0;
                    let padding = 0;

                    if (area == 'SP' && parkingArea != 'SP') {
                        if (parkingArea != 'SP') {
                            padding += parking['SP'].length;
                        }
                        if (parkingArea != 'MP') {
                            padding += parking['MP'].length;
                        }
                    }
                    if (area == 'MP' && parkingArea == 'LP') {
                        padding += parking['MP'].length;
                    }

                    step += Math.abs((x + 1) - row + padding);
                    step += Math.abs((y + 1) - column);
                    choices.push({
                        area: parkingArea,
                        row: x,
                        column: y,
                        step: step
                    });
                }
            }
        }
    }

    if (choices.length < 1) {
        res.send('No available parking slot <br> ' + display());
    }

    let sizes = ['LP'];
    if (size != 'l') {
        sizes.push('MP');
    }
    if (size != 'm' && size != 'l') {
        sizes.push('SP');
    }

    let options = choices.filter(x => sizes.includes(x.area));


    let nearest = options[0];
    options.map(x => {
        if (x.step < nearest.step) {
            nearest = x;
        }
    })

    selectedParking = parking[nearest.area][nearest.row][nearest.column];
    selectedParking.type = 'taken';
    selectedParking.plate_no = plate_no;
    selectedParking.entraceDate = new Date();
    selectedParking.carType = size;

    let result = `
    Area: ${nearest.area} <br>
    Row: ${nearest.row + 1} <br>
    Column: ${nearest.column + 1} <br>
    ${display()}`;
    res.send(result);

});


router.get('/display', (req, res) => {
    const result = display();
    res.send(result);
});

router.get('/info', (req, res) => {
    try {
        const { area, row, column } = req.query;
        const data = parking[area][row - 1][column - 1];
        let result = data.type ? JSON.stringify(data) : 'Parking space empty';
        result += `<br> ${display()}`
        res.send(result);
    }
    catch(e) {
        res.status(400).send('Parking space empty');
    }
    
});


router.post('/pay', (req, res) => {
    const { area, row, column } = req.body;

    try {
        let item = parking[area][row - 1][column - 1];
        if (!item.type) {
            throw new Error();
        }
        const data = Object.assign({}, item);
        item = {};

        const exitDate = new Date();


        let duration = Math.ceil(moment.duration(moment(exitDate).diff(moment(data.entraceDate))).asHours());
        duration -= 1; // 40 pesos fix rate

        let fee = 40;
        while ((duration / 24) > 1) {
            duration -= 24;
            fee += 5000;
        }

        // 20/hour for vehicles parked in SP;
        // 60/hour for vehicles parked in MP; and
        // 100/hour for vehicles parked in LP
        let rate = 0;
        switch (data.carType) {
            case 's':
                rate = 20;
                break;
            case 'm':
                rate = 60;
                break;
            case 'l':
                rate = 100;
                break;
        }
        fee += (duration * rate);

        let result = `
        Plate Number: ${data.plate_no}<br>
        Car Type: ${data.carType} <br>
        Entrance Date: ${moment(data.entraceDate).format('MM/DD/YYYY hh:mm:ss a')} <br>
        Exit Date: ${moment(exitDate).format('MM/DD/YYYY hh:mm:ss a')} <br>
        Parking fee: ${fee}`;
        result += `<br> ${display()}`
        res.send(result);
    }
    catch (e) {
        res.status(400).send('No vehicle parked on this slot');
    }
})

function display() {
    let result = ``;
    for (i in parking) {
        result += `${i} <br>`;
        for (let x = 0; x < parking[i].length; x++) {
            for (let y = 0; y < parking[i][x].length; y++) {
                let item = Object.assign({}, parking[i][x][y]);

                switch (item.type) {
                    case 'entry':
                        result += `[<i style="color: blue">entry</i>]`;
                        break;
                    case 'taken':
                        result += `[<i style="color: red">taken</i>]`;
                        break;
                    default:
                        result += `[space]`;
                        break;
                }

            }
            result += `<br>`;
        }
    }
    return result;
}


module.exports = router;