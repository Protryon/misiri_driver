const usb = require('usb');
const readline = require('readline');
const readlineInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const track0ISOAlphabet = Object.fromEntries(Object.entries({
    '0000001': ' ',
    '1000000': '!',
    '0100000': '"',
    '1100001': '#',
    '0010000': '$',
    '1010001': '%',
    '0110001': '&',
    '1110000': '\'',
    '0001000': '(',
    '1001001': ')',
    '0101001': '*',
    '1101000': '+',
    '0011001': ',',
    '1011000': '-',
    '0111000': '.',
    '1001001': '/',
    '0000100': '0',
    '1000101': '1',
    '0100101': '2',
    '1100100': '3',
    '0010101': '4',
    '1010100': '5',
    '0110100': '6',
    '1110101': '7',
    '0001101': '8',
    '1001100': '9',
    '0101100': ':',
    '1101101': ';',
    '0011100': '<',
    '1011101': '=',
    '0111101': '>',
    '1111100': '?',
    '0000010': '@',
    '1000011': 'A',
    '0100011': 'B',
    '1100010': 'C',
    '0010011': 'D',
    '1010010': 'E',
    '0110010': 'F',
    '1110011': 'G',
    '0001011': 'H',
    '1001010': 'I',
    '0101010': 'J',
    '1101011': 'K',
    '0011010': 'L',
    '1011011': 'M',
    '0111011': 'N',
    '1111010': 'O',
    '0000111': 'P',
    '1000110': 'Q',
    '0100110': 'R',
    '1100111': 'S',
    '0010110': 'T',
    '1010111': 'U',
    '0110111': 'V',
    '1110110': 'W',
    '0001110': 'X',
    '1001111': 'Y',
    '0101111': 'Z',
    '1101110': '[',
    '0011111': '\\',
    '1011110': ']',
    '0111110': '^',
    '1111111': '_',
}).map(([key, value]) => [parseInt(key, 2).toString(), value]));

const track0ISOAlphabetInverted = Object.fromEntries(Object.entries(track0ISOAlphabet).map(([key, value]) => [value, parseInt(key)]));

const track1ISOAlphabet = Object.fromEntries(Object.entries({
    '00001': '0',
    '10000': '1',
    '01000': '2',
    '11001': '3',
    '00100': '4',
    '10101': '5',
    '01101': '6',
    '11100': '7',
    '00010': '8',
    '10011': '9',
    '01011': ':',
    '11010': ';',
    '00111': '<',
    '10110': '=',
    '01110': '>',
    '11111': '?',
}).map(([key, value]) => [parseInt(key, 2).toString(), value]));

const track1ISOAlphabetInverted = Object.fromEntries(Object.entries(track1ISOAlphabet).map(([key, value]) => [value, parseInt(key)]));

const lrc = (len, alphabet, data) => {
    let bits = [];
    for (let i = 0; i < len; ++i) {
        bits[i] = 0;
    }
    for (let octet of data) {
        let bin = alphabet[octet.toString()];
        for (let i = 0; i < len; ++i) {
            if (bin & (1 << i)) {
                bits[i] += 1;
            }
        }
    }
    bits = bits.map(x => x % 2 == 1);
    bits[0] = bits.slice(1).filter(x => x).length % 2 == 0;
    let final = 0;
    for (let i = 0; i < bits.length; ++i) {
        if (bits[i]) {
            final |= 1 << i;
        }
    }
    return final;
};

const parsePacket = hex => {
    let acc = [];
    hex.split('').forEach((item, i) => {
        i % 2 == 0 ? acc.push([item]) : acc[acc.length - 1].push(item);
    }, []);
    return acc.map(octSet => parseInt(octSet.join(''), 16));
}

const promisify = func => (...args) => new Promise((resolve, reject) => {
    try {
        func(...args, (...subArgs) => resolve(subArgs));
    } catch (e) {
        reject(e);
    }
}); 

const sendControlChunk = packet => new Promise((resolve, reject) => {
    device.controlTransfer(0x21, 9, 0x0300, 0, packet, (error, data) => {
        if (error != null) {
            reject(error);
        }
        resolve(data);
    });
});

const sendControl = async packet => {
    let written = 0;
    while (written < packet.length) {
        let header = 0x80;
        let len = 0x3F;
        if (packet.length - written < 0x3F) {
            header |= 0x40;
            len = packet.length - written;
        }
        header |= len;
        let chunk = [header, ...packet.slice(written, written + len)];
        written += len;
        await sendControlChunk(Buffer.from(chunk));
    }
}

const outbound = {
    'reset': '1b61',
    'getFirmwareVersion': '1b76',
    'setBPC': '1b6f',
    'setHiCo': '1b78',
    'setLoCo': '1b79',
    'setBPI': '1b62',
    'setLeadingZeros': '1b7a',
    'enableRead': '1b6d',
    'disableRead': '1b61',
    'greenLEDOn': '1b83',
    'redLEDOn': '1b85',
    'powerOff': '1bac',
    'getVoltage': '1ba3',
    'getParameter': '1ba2',
    'getDeviceModel': '1b74',
    'setParameter': '1ba1',
    'enableWrite': '1b6e1b73',
};

const assemblePacket = (opcode, data = []) => {
    const opcodeEncoded = parsePacket(outbound[opcode] || opcode);
    return [...opcodeEncoded, ...data];
};

const connectToDevice = () => {

    const device =  usb.findByIds(0x0801, 0x0003);

    device.open();

    console.log(`${device.interfaces.length} interfaces found.`);

    const [ interface ] = device.interfaces;

    if (interface.isKernelDriverActive()) {
        console.log('detaching device from kernel...');
        interface.detachKernelDriver();
        console.log('detached');
    }
    interface.claim();

    return { device, interface };
}

const { device, interface } = connectToDevice();
let connectedToDevice = true;

function* receivePacket(endpoint) {
    endpoint.transferType = 2;
    endpoint.startPoll(1, 64);
    let currentWaiters = [];
    let incoming = [];
    let currentData = [];
    endpoint.on('data', function (data) {
        let head = data[0];
        if ((head & 0x80) != 0x80 && currentData.length == 0) {
            throw new Error('invalid header byte received');
        }
        let length = head & 0x3F;
        currentData.push(...(data.slice(1, length + 1)));
        if ((head & 0x40) != 0x40) { // continuation
            return;
        }

        if (currentWaiters.length > 0) {
            currentWaiters.shift()(currentData);
        } else {
            incoming.push(currentData);
        }
        currentData = [];
    });
    endpoint.on('error', function (error) {
        throw new Error(error);
    });
    endpoint.on('end', function (error) {
        connectedToDevice = false;
    });
    while (connectedToDevice) {
        yield new Promise((resolve) => {
            if (incoming.length > 0) {
                resolve(incoming.shift());
            } else {
                currentWaiters.push(resolve);
            }
        });
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const resetDevice = async () => void 0; // promisify(device.reset.bind(device));

// valid BPIs are 75 & 210
const deviceConfig = {
    tracks: [
        {
            bpc: 8,
            bpi: 210,
        },
        {
            bpc: 8,
            bpi: 75,
        },
        {
            bpc: 8,
            bpi: 210,
        },
    ],
    leadingZero210: 61,
    leadingZero75: 22,
    isHiCo: true,
};

const toHexString = arr => {
    let out = [];
    for (let i of arr) {
        let c = i.toString(16);
        while (c.length < 2) {
            c = `0${c}`;
        }
        out.push(c);
    }
    return out.join('');
}

const bitStream = data => {
    return {
        raw: data,
        _bitIndex: 0,
        read: function(ct) {
            if (this._bitIndex + ct >= this.raw.length * 8) {
                return null;
            }
            let baseIndex = (this._bitIndex / 8) | 0;
            let bytes = this.raw.slice(baseIndex, Math.ceil((this._bitIndex + ct) / 8));
            let value = 0;
            let bitOffset = this._bitIndex % 8;
            let bitMask = 0;
            for (let i = bitOffset; i < Math.min(bitOffset + ct, 8); ++i) {
                bitMask |= 1 << (7 - i);
            }
            value = (bytes[0] & bitMask) >>> Math.max(0, (8 - ct) - bitOffset);
            for (let i = 1; i < bytes.length - 1; ++i) {
                value <<= 8;
                value |= bytes[i];
            }
            if (bytes.length > 1) {
                let remainingBits = ct - (8 - (this._bitIndex % 8)) - Math.max(0, bytes.length - 2) * 8;
                let bitTrailOffset = remainingBits;
                value <<= bitTrailOffset;
                bitMask = 0;
                for (let i = 0; i < bitTrailOffset; ++i) {
                    bitMask |= 1 << (7 - i);
                }
                value |= (bytes[bytes.length - 1] & bitMask) >>> (8 - bitTrailOffset);
            }
            this._bitIndex += ct;
            return value;
        },
        write: function(ct, value) {
            let bitMask = 0;
            for (let i = 0; i < ct; ++i) {
                bitMask |= 0x01 << i;
            }
            let toWrite = value & bitMask;
            let bitOffset = this._bitIndex % 8;
            let byteOffset = (this._bitIndex / 8) | 0;
            const rsh = (a1, a2) => a2 >= 0 ? a1 >>> a2 : a1 << -a2;
            // clear
            this.raw[byteOffset] &= ~rsh(bitMask, (ct - (8 - bitOffset))) & 0xFF;
            this.raw[byteOffset] |= rsh(toWrite, (ct - (8 - bitOffset))) & 0xFF;
            let octetCount = Math.floor((ct - (8 - bitOffset)) / 8);
            const modifiedBitOffset = (ct - (8 - bitOffset)) % 8;
            for (let i = byteOffset + octetCount; i >= byteOffset + 1; --i) {
                this.raw[i] = rsh(toWrite, modifiedBitOffset + (8 * (i - byteOffset - octetCount))) & 0xFF;
            }
            if (modifiedBitOffset > 0) {
                this.raw[byteOffset + octetCount + 1] &= ~(bitMask << (8 - modifiedBitOffset)) & 0xFF;
                this.raw[byteOffset + octetCount + 1] |= (toWrite << (8 - modifiedBitOffset)) & 0xFF;
            }
            this._bitIndex += ct;
        },
        seek: function(ct) {
            this._bitIndex += ct;
            if (this._bitIndex < 0) {
                this._bitIndex = 0;
            } else if (this._bitIndex > this.raw.length * 8) {
                this._bitIndex = this.raw.length * 8;
            }
        }
    }
};

(async () => {
    await resetDevice();
    console.log(`${interface.endpoints.length} endpoints found.`);

    const [ inEndpoint ] = interface.endpoints;

    const reader = receivePacket(inEndpoint);
    try {
        await sendControl(assemblePacket('reset'));
    } catch (e) {
        
    }
    console.log('Resetting device');
    const readSuccess = async () => {
        for (let i = 0; i < 5; ++i) {
            const received = await reader.next().value;
            if (received[0] == 0x1B) {
                if (received[1] == 0x30) {
                    return true;
                } else {
                    await sendControl(assemblePacket('disableRead'));
                    return false;
                }
            }
        }
        return false;
    }
    const readReturn = async () => {
        for (let i = 0; i < 5; ++i) {
            const received = await reader.next().value;
            if (received != null && received[0] == 0x1B && received[1] != 0x30) {
                return received.slice(1);
            }
        }
        return null;
    }
    while(true) {
        await sleep(250);
        try {
            await sendControl(assemblePacket('getFirmwareVersion'));
        } catch (e) {
            continue;
        }
        break;
    }
    console.log('Requested firmware version');
    const firmwareReceived = await readReturn();
    console.log('Received firmware version');
    const firmwareVersion = Buffer.from(firmwareReceived.slice(1)).toString();
    console.log(`Firmware Version: ${firmwareVersion}`);
    let bpc = deviceConfig.tracks.map(track => track.bpc);
    await sendControl(assemblePacket('setBPC', bpc));
    await readSuccess();
    await sendControl(assemblePacket(deviceConfig.isHiCo ? 'setHiCo' : 'setLoCo'));
    await readSuccess();
    await sendControl(assemblePacket('setBPI', [deviceConfig.tracks[0].bpi == 210 ? 0xa1 : 0xa0]));
    await readSuccess();
    await sendControl(assemblePacket('setBPI', [deviceConfig.tracks[1].bpi == 210 ? 0xc1 : 0xc0]));
    await readSuccess();
    await sendControl(assemblePacket('setBPI', [deviceConfig.tracks[2].bpi == 210 ? 0xd2 : 0x4b]));
    await readSuccess();
    await sendControl(assemblePacket('setLeadingZeros', [deviceConfig.leadingZero210, deviceConfig.leadingZero75]));
    await readSuccess();
    await sendControl(assemblePacket('getVoltage'));
    const rawVoltage = await readReturn();
    const voltage = Math.round((rawVoltage[0] + (rawVoltage[1] / 255.0)) * 9.9 / 128.0 * 100.0) / 100.0;
    console.log(`Voltage: ${voltage}`);
    await sendControl(assemblePacket('getDeviceModel'));
    const rawModel = await readReturn();
    console.log(`Model version: 0x${toHexString(rawModel)}`);
    console.log('Ready to read.\n');
    let isReading = false;
    let isWriting = false;

    const readData = async () => {
        const received = await reader.next().value;
        if (received == null || received[0] != 0x1B || received[1] != 0x73) {
            throw new Error('malformed response from device');
        }
        let trackData = [];
        let rIndex = 2;
        for (let i = 1; i <= 3; ++i) {
            if (received[rIndex] != 0x1B || received[rIndex + 1] != i) {
                throw new Error('malformed response from device');
            }
            rIndex += 2;
            const trackLength = received[rIndex];
            ++rIndex;
            trackData.push(received.slice(rIndex, rIndex + trackLength));
            rIndex += trackLength;
        }
        console.log('Incoming read: [RAW]');
        console.log(trackData.map((track, i) => `Track ${i + 1}: ${toHexString(track)}`).join('\n'));
        const isoDecoded = [[], [], []];
        let track0Stream = bitStream(trackData[0]);
        let temp = null;
        while ((temp = track0Stream.read(7)) != null) {
            isoDecoded[0].push(track0ISOAlphabet[temp.toString()] || '~');
        }
        let track1Stream = bitStream(trackData[1]);
        while ((temp = track1Stream.read(5)) != null) {
            isoDecoded[1].push(track1ISOAlphabet[temp.toString()] || '~');
        }
        let track2Stream = bitStream(trackData[2]);
        while ((temp = track2Stream.read(5)) != null) {
            isoDecoded[2].push(track1ISOAlphabet[temp.toString()] || '~');
        }
        let isoTracks = isoDecoded.map(track => track.join(''));

        for (let i = 0; i < isoTracks.length; ++i) {
            let endIndex = isoTracks[i].indexOf('?');
            let startIndex = isoTracks[i].indexOf(';');
            if (startIndex < 0 || endIndex < 0) {
                isoTracks[i] = isoTracks[i].length > 0 ? 'Corrupt Data' : 'No Data';
            } else {
                isoTracks[i] = isoTracks[i].slice(startIndex, endIndex + 1);
                if (isoTracks[i].includes('~')) {
                    isoTracks[i] = 'Corrupt Data';
                }
            }
        }
        let track0Checksum = lrc(7, track0ISOAlphabetInverted, isoTracks[0].split(''));
        let track1Checksum = lrc(5, track1ISOAlphabetInverted, isoTracks[1].split(''));
        let track2Checksum = lrc(5, track1ISOAlphabetInverted, isoTracks[2].split(''));
        //TODO: validate checksums
        console.log('Incoming read: [ISO]');
        console.log(isoTracks.map((track, i) => `Track ${i + 1}: ${track}`).join('\n'));
        return { isoTracks, trackData };
    }

    process.on('SIGINT', function() {    
        if (isReading || isWriting) {
            sendControl(assemblePacket('disableRead')).then(() => {
                isReading = false;
                isWriting = false;
                process.exit();
            });
        } else {
            process.exit();
        }
    });

    const writeRawData = async data => {
        const tracks = data.map(track => track.map(octet => {
            let bits = [octet & 0x80, octet & 0x40, octet & 0x20, octet & 0x10, octet & 0x08, octet & 0x04, octet & 0x02, octet & 0x01].map(bit => bit != 0);
            let value = 0;
            let currentBit = 0x80;
            for(let i = bits.length - 1; i >= 0; --i) {
                if (bits[i]) {
                    value |= currentBit;
                }
                currentBit /= 2;
            }
            return value;
        }));
        const outData = [0x1b, 0x01, tracks[0].length, ...tracks[0], 0x1b, 0x02, tracks[1].length, ...tracks[1], 0x1b, 0x03, tracks[2].length, ...tracks[2], 0x3F, 0x1C];
        isWriting = true;
        await sendControl(assemblePacket('enableWrite', outData));
        const success = await readSuccess();
        isWriting = false;
        console.log(success ? 'Written successfully' : 'Failed to write');
        return success;
    };

    const encodeISO = async (map, length, track) => {
        const output = [];
        const outStream = bitStream(output);
        track.split('').map(c => map[c] || c).forEach(c => {
            if (typeof c == 'string') {
                throw new Error('invalid character in track: ' + c);
            }
            outStream.write(length, c);
        });
        outStream.write(length, lrc(length, map, track.split('')));
        return output;
    };

    readlineInterface.on("line", async line => {
        let endOfCommand = line.indexOf(" ");
        if (endOfCommand < 0) {
            endOfCommand = line.length;
        }
        const command = line.substring(0, endOfCommand).trim();
        const arg = endOfCommand >= line.length ? '' : line.substring(endOfCommand + 1).trim();
        if (command == 'read') {
            isReading = true;
            await sendControl(assemblePacket('enableRead'));
            await readData();
            isReading = false;
            // read is disabled
        } else if (command == 'read_cycle') {
            while (true) {
                isReading = true;
                await sendControl(assemblePacket('enableRead'));
                await readData();
            }
        } else if (command == 'write_raw') {
            const data = arg.split(' ').map(datum => datum == 'none' || datum == 'null' ? '' : datum);
            if (data.length != 3) {
                console.log('invalid data, need 3 tracks, space delimited');
                return;
            }
            await writeRawData(data.map(packet => parsePacket(packet)));
        } else if (command == 'clone') {
            isReading = true;
            await sendControl(assemblePacket('enableRead'));
            const { trackData } = await readData();
            isReading = false;

            for (let i = 0; i < 5; ++i) {
                if (await writeRawData(trackData)) {
                    break;
                }
                console.log(`Attempt #${i + 1}/5 failed, try again.`);
            }
        } else if (command == 'write_iso') {
            const data = arg.split('~').map(datum => datum == 'none' || datum == 'null' ? '' : datum);
            if (data.length != 3) {
                console.log('invalid data, need 3 tracks, ~ delimited');
                return;
            }
            const isoEncoded = [
                await encodeISO(track0ISOAlphabetInverted, 7, data[0]),
                await encodeISO(track1ISOAlphabetInverted, 5, data[1]),
                await encodeISO(track1ISOAlphabetInverted, 5, data[2]),
            ];
            for (let i = 0; i < 5; ++i) {
                if (await writeRawData(isoEncoded)) {
                    break;
                }
                console.log(`Attempt #${i + 1}/5 failed, try again.`);
            }
        } else if (command == 'write_script') {
            script = require(arg);
            for (let write of script.getISOWrites()) {
                if (write.trim().length == 0) {
                    return;
                }
                console.log('Script writing: ' + write.trim());
                const data = write.trim().split('~').map(datum => datum == 'none' || datum == 'null' ? '' : datum);
                if (data.length != 3) {
                    console.log('invalid data, need 3 tracks, ~ delimited');
                    return;
                }
                const isoEncoded = [
                    await encodeISO(track0ISOAlphabetInverted, 7, data[0]),
                    await encodeISO(track1ISOAlphabetInverted, 5, data[1]),
                    await encodeISO(track1ISOAlphabetInverted, 5, data[2]),
                ];
                for (let i = 0; i < 5; ++i) {
                    if (await writeRawData(isoEncoded)) {
                        break;
                    }
                    console.log(`Attempt #${i + 1}/5 failed, try again.`);
                }
            }
        } else {
            console.log(`Invalid command: ${command}`);
            console.log('Valid commands:');
            console.log('* read -- prepare the card reader to read a card, outputs in Raw and ISO');
            console.log('* read_cycle -- read repeatedly until execution halts');
            console.log('* write_raw -- prepare to write a raw hex stream to the card. usage: write_raw track1/none track2/none track3/none');
            console.log('* clone -- prepare to read a card, and upon read success, prepare to write another card with raw equivalent data');
            console.log('* write_iso -- prepare to write ISO data to a card, usage: write_iso track1/none~track2/none~track3/none');
            console.log('* write_script -- enables write_iso macro to be loaded');
        }
    });
    
    console.log('Initialized Device');
})();
