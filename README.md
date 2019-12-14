# Misiri Driver

A driver for Misiri MSR605X/MSRX/similar USB magnetic stripe reader/writer compatible with Linux/Mac/Windows.

## Motivation & Goals

At time of writing, Misiri's primary driver download website is not online, and has not been for some time.

Paired with the lack of linux support and poor software quality, this driver aims to replace the core functionality of the software provided by Misiri.

## Device Support

All testing was does with a Misiri MSR605X via USB on an Ubuntu 19.04 host system. Bluetooth is not supported. Similar Misiri devices are likely to work.

## Running

* Install nodejs 10+
* Run `npm i` to install required packages.
* Run `node index.js` to initialize the CLI.

## Commands

* read -- prepare the card reader to read a card, outputs in Raw and ISO
* read_cycle -- read repeatedly until execution halts
* write_raw -- prepare to write a raw hex stream to the card. usage: `write_raw track1/none track2/none track3/none`
* clone -- prepare to read a card, and upon read success, prepare to write another card with raw equivalent data
* write_iso -- prepare to write ISO data to a card, usage: `write_iso track1/none~track2/none~track3/none`
* write_script -- enables write_iso macro to be loaded

## Support

If you have issues running this driver, please fill out a bug report on GitHub, providing all command line input/output, your OS, model of your device, and any other relevant information.
