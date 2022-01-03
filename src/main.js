$('.btn').click(ble);

function toggle(flag) {
    return !flag;
}

let currentDevice;
let isPause = false;
let isFilt = false;
const serviceUUID = "0000ff04-0000-1000-8000-00805f9b34fb"
const charUUID = "0000aa04-0000-1000-8000-00805f9b34fb"
let package = [];
let datas = [];
let currentTime = 0;
let times = [];

const fs = 500;
const totalTime = 5;

const points = fs * totalTime;

let avg_coef_len = Math.floor(fs / 60);
const coef = Array(avg_coef_len).fill(1 / avg_coef_len);
const queue = Array(avg_coef_len).fill(0);

function movingAvg(dot, coef, flag) {
    queue.shift();
    queue.push(dot);

    let tmp = 0;
    queue.forEach((_, idx) => tmp += coef[idx] * queue[idx]);
    return (flag) ? tmp : dot;
}

const ECG = {
    x: times,
    y: datas,
    mode: "lines",
    name: "ECG",
    marker: {
        color: "green",
        size: 12
    }
};

const layout = {
    title: "Heart Signal",
    xaxis: { range: [0, totalTime] },
    yaxis: { range: [0, 5] }
};

var config = { responsive: true }

Plotly.newPlot("chart", [ECG], layout, config);

const timer = {
    timerFlag: 0,
    startTimer: function () {
        this.timerFlag = setInterval(() => {
            ECG.x = times;
            ECG.y = datas;

            const ctime = (currentTime - times.length) / fs;
            layout.xaxis.range = [ctime, ctime + totalTime];

            Plotly.redraw("chart")

        }, 200);
    },
    stopTimer: function () {
        clearInterval(this.timerFlag);
        this.timerFlag = 0;
    }
};

function ble(evt) {

    function scan() {
        navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [serviceUUID]
        }).then(device => {
            currentDevice = device;
            console.log("Selected: ", currentDevice);
        }).catch(err => console.log("Error: ", err));
    }

    function connect(dev) {
        console.log(dev)
        timer.startTimer();

        dev.gatt.connect().then(server => {
            console.log(server);
            return server.getPrimaryService(serviceUUID);
        }).then(service => {
            console.log(service);
            return service.getCharacteristic(charUUID);
        }).then(char => {
            console.log(char);
            char.startNotifications().then(c => {
                c.addEventListener("characteristicvaluechanged", function (evt) {
                    if (!isPause) {
                        package = Array.from(new Uint16Array(this.value.buffer));
                        $("#package-header")[0].innerHTML = "Package Point: " + package.length;
                        $("#package-body")[0].innerHTML = "[" + package + "]";

                        package.forEach(dot => {
                            currentTime++;
                            if (datas.length < points) {
                                datas.push(movingAvg(dot * 3.6 / 4096, coef, isFilt));
                                times.push((currentTime / fs));
                            } else {
                                datas = [movingAvg(dot * 3.6 / 4096, coef, isFilt)];
                                times = [(currentTime / fs)];
                            }
                        })
                    }

                });
            });
        }).catch(err => console.log("Error: ", err))
    }

    function disconnect(dev) {
        dev.gatt.disconnect();
        console.log(dev.name, "Disconnected");
        package = [];
        datas = [];
        currentTime = 0;
        times = [];
        timer.stopTimer();
    }

    console.log(evt.target.innerHTML, 'Clicked')

    switch (evt.target.innerHTML) {
        case "Scan":
            scan();
            break;
        case "Connect":
            connect(currentDevice);
            break;
        case "Disconnect":
            disconnect(currentDevice);
            break;
        case "Pause/Run":
            isPause = toggle(isPause);
            break;
        case "Filter ON/OFF":
            isFilt = toggle(isFilt);
            break;
        default:
            console.log("No such case....")
    }
}