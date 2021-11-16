/* jshint -W097 */ // jshint strict:false
/*jslint node: true */

"use strict";
var utils = require('@iobroker/adapter-core'); // Get common adapter utils
var request = require('request');
var lang = 'de';
var callReadHomepilot;
var ip = '';
var link = '';
var sync = 12;

var adapter = utils.Adapter({
    name: 'homepilot',
    systemConfig: true,
    useFormatDate: true,
    stateChange: function(id, state) {
        if (!id || !state || state.ack) return;
        //if ((!id.match(/\.level\w*$/) || (!id.match(/\.cid\w*$/)) return; // if datapoint is not "level" or not "cid"
        adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
        adapter.log.debug('input value: ' + state.val.toString());
        controlHomepilot(id, state.val.toString());
    },
    unload: function(callback) {
        try {
            adapter.log.info('terminating homepilot adapter');
            stopReadHomepilot();
            callback();
        } catch (e) {
            callback();
        }
    },
    ready: function() {
        adapter.log.debug('initializing objects');
        main();
    }
});

function stopReadHomepilot() {
    clearInterval(callReadHomepilot);
    adapter.log.info('Homepilot adapter stopped');
}

function controlHomepilot(id, input) {
    // example for subscribed id: "homepilot.0.devices.RolloTronStandard.10000.cid"
    // example for subscribed id: "homepilot.0.devices.RolloTronStandard.10000.level"
    var controller_array = id.split('.');
    var controller       = controller_array[5];
    var deviceid         = controller_array[4];  // String
    var url;
    var valid = false;
    var newcid;
    adapter.log.debug('State: ' + controller + '  device: ' + deviceid + '  command: ' + input);
    if (controller == 'cid') { // control via cid
        // hier CID auf Plausibiliät checken
        switch (input) {
            case "1":
            case "UP":
            case "up":
            case "HOCH":
            case "hoch":
            case "RAUF":
            case "rauf":
                newcid = 1;
                valid = true;
                break;
            case "2":
            case "STOP":
            case "stop":
            case "Stop":
                newcid = 2;
                valid = true;
                break;
            case "3":
            case "DOWN":
            case "down":
            case "RUNTER":
            case "runter":
                newcid = 3;
                valid = true;
                break;
            case "4":
            case "0%":
            case "POSITION_0":
            case "position_0":
                newcid = 4;
                valid = true;
                break;
            case "5":
            case "25%":
            case "POSITION_25":
            case "position_25":
                newcid = 5;
                valid = true;
                break;
            case "6":
            case "50%":
            case "POSITION_50":
            case "position_50":
                newcid = 6;
                valid = true;
                break;
            case "7":
            case "75%":
            case "POSITION_75":
            case "position_75":
                newcid = 7;
                valid = true;
                break;
            case "8":
            case "100%":
            case "POSITION_100":
            case "position_100":
                newcid = 8;
                valid = true;
                break;
            case "9":
            case "POSITION_N":
                newcid = 9;
                valid = false; // weiterer Wert nötig; tbc
                break;
            case "10":
            case "true":
            case "EIN":
            case "ein":
            case "AN":
            case "an":
            case "ON":
            case "on":
                newcid = 10;
                valid = true;
                break;
            case "11":
            case "false":
            case "AUS":
            case "aus":
            case "OFF":
            case "off":
                newcid = 11;
                valid = true;
                break;
            case "23":
            case "+":
            case "increment":
            case "INCREMENT":
                newcid = 23;
                valid = true;
                break;
            case "24":
            case "-":
            case "decrement":
            case "DECREMENT":
                newcid = 24;
                valid = true;
                break;
            default:
                adapter.log.warn('Wrong CID entered');
                valid = false;
        }

        if (valid) url = 'http://' + ip + '/deviceajax.do?did=' + deviceid + '&cid=' + newcid + '&command=1';
    } else if (controller == 'state') { // control via state e.g. Universal-Aktor switch
        if (input.search(/(true)|(EIN)|(AN)|(ON)|([10-11])|(false)|(AUS)|(OFF)\b\b/gmi) != -1) { // check if "true" or "false"
            valid = true;
            if (input.search(/(true)|(EIN)|(AN)|(ON)|(10)\b\b/gmi) != -1 ) newcid = '10'; 
            if (input.search(/(false)|(AUS)|(OFF)|(11)\b\b/gmi) != -1 ) newcid = '11'; 
            url = 'http://' + ip + '/deviceajax.do?did=' + deviceid + '&cid=' + newcid + '&command=1'; // switch ON / OFF
            adapter.log.debug('Switch ' + deviceid + ' new status detected: ' + input + ' URL: '  + url);
        } else {
            valid = false;
            adapter.log.warn('Only use "ON/OFF", "true/false", "ein/aus" (all caseinsensitive) or "10/11" to control you switch');
        }
    } else if (controller == 'level') { // control via level e.g. RolloTronStandar.level
        // check if input number is between 0 an 100
        if (input.search(/(?:\b|-)([0-9]{1,2}[0]?|100)\b/gmi) != -1) { // 0 to 100 https://regex101.com/r/mN1iT5/6#javascript
            valid = true;
            url = 'http://' + ip + '/deviceajax.do?cid=9&did=' + deviceid + '&goto=' + input + '&command=1';
        } else valid = false;
    } else if (controller == 'temperature') { // control via temperature e.g. Heizkörperstellantrieb
		var product = controller_array[3];
		var val = (parseFloat(input)*10);

		if (product.indexOf('Raumthermostat') != -1) {
			// limit value to 4..40°C
			if (val < 4.0) {
				val = 4.0;
			} else if (val > 400.0) {
				val = 400.0;
			}
		} else if (product.indexOf('DuoFernHeizkörperstellantrieb') != -1) {
			// limit value to 4..28°C
			if (val < 4.0) {
				val = 4.0;
			} else if (val > 280.0) {
				val = 280.0;
			}
		} else {
			// limit value to 0..28°C
			if (val < 0.0) {
				val = 0.0;
			} else if (val > 280.0) {
				val = 280.0;
			}
		}
				
		var parts = (val.toString()).split(".");
		input = parts[0]; 
		
	    // adapter.log.info('input temperature converted: ' + input);
        valid = true;
        url = 'http://' + ip + '/deviceajax.do?cid=9&did=' + deviceid + '&goto=' + input + '&command=1';
    } else if (controller == 'level_inverted') { // control via inverted  level e.g. RolloTronStandar.level (like Homematic 100% up, 0% down)
        // check if input number is between 0 an 100
        if (input.search(/(?:\b|-)([0-9]{1,2}[0]?|100)\b/gmi) != -1) { // 0 to 100 https://regex101.com/r/mN1iT5/6#javascript
            valid = true;
            url = 'http://' + ip + '/deviceajax.do?cid=9&did=' + deviceid + '&goto=' + (100 - parseInt(input,10)) + '&command=1';
        } else valid = false;
    } else if (controller == 'stop') { // control via stop button e.g. blinds e.g. RolloTronStandard
        if (input.search(/(true)|(EIN)|(AN)|(ON)|([0-1])|(false)|(AUS)|(OFF)\b\b/gmi) != -1) { // check if "true" or "false"
            valid = true;
            if (input.search(/(true)|(EIN)|(AN)|(ON)|(1)\b\b/gmi) != -1 ) newcid = '2'; 
            //if (input.search(/(false)|(AUS)|(OFF)|(0)\b\b/gmi) != -1 ) newcid = '2';  // only input true makes sense for STOP-button
            url = 'http://' + ip + '/deviceajax.do?did=' + deviceid + '&cid=' + newcid + '&command=1'; // STOP
            adapter.log.debug('STOP button ' + deviceid + ' new status detected: ' + input + ' URL: '  + url);
        } else {
            valid = false;
            adapter.log.warn('Only use "ON", "true", "ein" (all caseinsensitive) or "1" to control your button STOP');
        }
    }
	
    if (valid) {
        request(url); // Send command to Homepilot
        adapter.log.debug('Command sent to Homepilot because "' + input + '" written to State "' + id + '"'); // should be debug not info
    } else adapter.log.warn('Wrong type of data input. Please try again');
}

function readSettings() {
    //check if IP is entered in settings
    if (adapter.config.homepilotip === undefined || adapter.config.homepilotip.length === 0) {
        ip = 'homepilot.local';
        adapter.log.error('No IP adress of Homepilot station set up - "' + ip + '" used');
	adapter.log.error('Adapter will be stopped');
	stopReadHomepilot();
    } 
    else ip = (adapter.config.homepilotport.length > 0) ? adapter.config.homepilotip + ':' + adapter.config.homepilotport : adapter.config.homepilotip;
    link = 'http://' + ip + '/deviceajax.do?devices=1';
    //check if sync time is entered in settings
    sync = (adapter.config.synctime === undefined || adapter.config.synctime.length === 0) ? 12 : parseInt(adapter.config.synctime,10);
    adapter.log.debug('Homepilot station and ioBroker synchronize every ' + sync + 's');
}

function createStates(result, i) {
    var product    = result.devices[i].productName.replace(/\s+/g, ''); // clear whitespaces in product name
    var deviceid   = result.devices[i].did;
    var devicename = result.devices[i].name;
    var path = 'devices.' + product + '.' + deviceid;
    var duoferncode = result.devices[i].serial;
    //var devicerole = (product.indexOf('RolloTron') != -1) ? 'blind' : 'switch' ; // tbd insert more products
    var devicerole;
    switch (duoferncode.substring(0,2)) {
        case "4": // Heizkörperstellantrieb Z-Wave
        case "5": // Heizkörperstellantrieb Z-Wave
        case "6": // Heizkörperstellantrieb Z-Wave
        case "7": // Heizkörperstellantrieb Z-Wave
        case "8": // Heizkörperstellantrieb Z-Wave
        case "9": // Heizkörperstellantrieb Z-Wave
        case "10": // Heizkörperstellantrieb Z-Wave
        case "11": // Heizkörperstellantrieb Z-Wave
        case "12": // Heizkörperstellantrieb Z-Wave
        case "13": // Heizkörperstellantrieb Z-Wave
        case "14": // Heizkörperstellantrieb Z-Wave
        case "15": // Heizkörperstellantrieb Z-Wave
        case "16": // Heizkörperstellantrieb Z-Wave
        case "17": // Heizkörperstellantrieb Z-Wave
        case "18": // Heizkörperstellantrieb Z-Wave
        case "19": // Heizkörperstellantrieb Z-Wave
			if (product.indexOf('Repeater') != -1) {
				devicerole = (devicename.indexOf('Licht') != -1) ? 'light.switch' : 'switch' ;
			} else {
				devicerole = 'level.temperature';
			}
            break;
        case "40": // Rollotron Standard
        case "41": // Rollotron Comfort
        case "42": // Rohrmotor
        case "47": // Rohrmotor
        case "49": // Rohrmotor
	case "4B": // DuoFern Connect-Aktor
	case "70": // Troll Comfort DuoFern
            devicerole = 'level.blind';
            break;
        case "48": // Dimmer
            devicerole = 'level.dimmer';
            break;
        case "43": // Universalactor
        case "46": // Wall-Plugin-Actor
		case "74": // Schaltaktor DuoFern Mehrfachwandtaster
            devicerole = (devicename.indexOf('Licht') != -1) ? 'light.switch' : 'switch' ;
            break;
		case "73": // Schaltaktor DuoFern Raumthermostat
		case "E1": // DuoFern Heizkörperstellantrieb
			devicerole = 'level.temperature';
			break;
        default:
            devicerole = 'switch'
    } // ENDE Switch
	
    // create Channel DeviceID
    adapter.setObjectNotExists(path, {
        type: 'channel',
        common: {
            name: devicename + ' (Device ID ' + deviceid + ')',
            role: devicerole,
        },
        native: {}
    });
	
    // create States
    adapter.setObjectNotExists(path + '.name', {
        type: 'state',
        common: {
            name: 'name ' + devicename,
            desc: 'name stored in homepilot for device ' + deviceid,
            type: 'string',
            role: 'text',
            read: true,
            write: false
        },
        native: {}
    });
    adapter.setObjectNotExists(path + '.description', {
        type: 'state',
        common: {
            name: 'description ' + devicename,
            desc: 'description stored in homepilot for device ' + deviceid,
            type: 'string',
            role: 'text',
            read: true,
            write: false
        },
        native: {}
    });
    adapter.setObjectNotExists(path + '.duofernCode', {
        type: 'state',
        common: {
            name: 'duofern code number of ' + devicename,
            desc: 'duofern code stored in homepilot for device ' + deviceid,
            type: 'string',
            role: 'text',
            read: true,
            write: false
        },
        native: {}
    });
    adapter.setObjectNotExists(path + '.productName', {
        type: 'state',
        common: {
            name: 'product name ' + devicename,
            desc: 'product name stored in homepilot for device ' + deviceid,
            type: 'string',
            role: 'text',
            read: true,
            write: false
        },
        native: {}
    });
    adapter.setObjectNotExists(path + '.status_changed', {
        type: 'state',
        common: {
            name: 'status changed ' + devicename,
            desc: 'time of last status changed for device ' + deviceid,
            type: 'number',
            role: 'value.datetime',
            read: true,
            write: false
        },
        native: {}
    });
    adapter.setObjectNotExists(path + '.hasErrors', {
        type: 'state',
        common: {
            name: 'number of errors ' + devicename,
            desc: 'number of errors of device ' + deviceid,
            type: 'number',
            role: 'value',
            min: 0,
            read: true,
            write: false
        },
        native: {}
    });
    adapter.setObjectNotExists(path + '.cid', {
        type: 'state',
        common: {
            name: 'Command ID input ' + devicename,
            desc: 'type in command id for ' + deviceid,
            type: 'string',
            read: true,
            write: true
        },
        native: {}
    });
    
    // create States depending on DuofernCode
    if (duoferncode.substring(0,2) == "43" || duoferncode.substring(0,2) == "46" || (parseInt(duoferncode.substring(0,2), 16) < 26 && product.indexOf('Repeater') != -1)) {
        adapter.setObjectNotExists(path + '.state', {
            type: 'state',
            common: {
                name: 'STATE of ' + devicename,
                desc: 'Boolean datapoint for switches for ' + deviceid,
                type: 'boolean',
                role: 'switch',
                def: false,
                read: true,
                write: true
            },
            native: {}
        }, function(err, obj) {
            if (!err && obj) {
                var statevalue = (result.devices[i].position == 100 || result.devices[i].position === '100') ? true : false;
                adapter.setState(path + 'state', {
                    val: statevalue,
                    ack: true
                });
            }
        });
    } else if (parseInt(duoferncode.substring(0,2),16) < 26 && product.indexOf('Repeater') == -1) { // HeizkörperstellantrieZ-Wave
       adapter.setObjectNotExists(path + '.temperature', {
            type: 'state',
            common: {
                name: 'Temperature of ' + devicename,
                desc: 'Temperature datapoint for ' + deviceid,
                type: 'number',
                role: devicerole,
		def: 0,
                min: 0,
                max: 28,
                unit: '°C',
                read: true,
                write: true
            },
            native: {}
        }, function(err, obj) {
            if (!err && obj) adapter.log.info('Objects for ' + product + '(' + deviceid + ') created');
        });
    } else if (duoferncode.substring(0,2) == "E1") {
	adapter.setObjectNotExists(path + '.temperature', {
            type: 'state',
            common: {
                name: 'Temperature of ' + devicename,
                desc: 'Temperature datapoint for ' + deviceid,
                type: 'number',
                role: devicerole,
		def: 4,
                min: 4,
                max: 28,
                unit: '°C',
                read: true,
                write: true
            },
            native: {}
        }, function(err, obj) {
            if (!err && obj) adapter.log.info('Objects for ' + product + '(' + deviceid + ') created');
        });
    } else if (duoferncode.substring(0,2) == "73") {
	adapter.setObjectNotExists(path + '.temperature', {
            type: 'state',
            common: {
                name: 'Temperature of ' + devicename,
                desc: 'Temperature datapoint for ' + deviceid,
                type: 'number',
                role: devicerole,
		def: 4,
                min: 4,
                max: 40,
                unit: '°C',
                read: true,
                write: true
            },
            native: {}
        }, function(err, obj) {
            if (!err && obj) adapter.log.info('Objects for ' + product + '(' + deviceid + ') created');
        });
		
	adapter.setObjectNotExists(path + '.current_temperature', {
            type: 'state',
            common: {
            name: 'current Temperature of ' + devicename,
                desc: 'current Temperature datapoint for ' + deviceid,
                type: 'number',
                role: devicerole,
		def: 4,
                min: 4,
                max: 40,
                unit: '°C',
                read: true,
                write: false
            },
            native: {}
        }, function(err, obj) {
            if (!err && obj) adapter.log.info('Objects for ' + product + '(' + deviceid + ') created');
        });
    } else {
        adapter.setObjectNotExists(path + '.level_inverted', {
            type: 'state',
            common: {
                name: 'level inverted ' + devicename,
                desc: 'level inverted (like Homematic) of device ' + deviceid,
                type: 'number',
                role: devicerole,
                min: 0,
                max: 100,
                unit: '%',
                read: true,
                write: true
            },
            native: {}
        });
        adapter.setObjectNotExists(path + '.level', {
            type: 'state',
            common: {
                name: 'level ' + devicename,
                desc: 'level of device ' + deviceid,
                type: 'number',
                role: devicerole,
                min: 0,
                max: 100,
                unit: '%',
                read: true,
                write: true
            },
            native: {}
        }, function(err, obj) {
            if (!err && obj) adapter.log.info('Objects for ' + product + '(' + deviceid + ') created');
        });
    } // ENDE else
    // create STOP datapoint for blinds
    // code "40" Rollotron Standard
    // code "41" Rollotron Comfort
    // code "42" Rohrmotor
    // code "47" Rohrmotor
    // code "49" Rohrmotor
	
    if (duoferncode.substring(0,2) == "40" 
        || duoferncode.substring(0,2) == "41"
	|| duoferncode.substring(0,2) == "42"
	|| duoferncode.substring(0,2) == "47"
	|| duoferncode.substring(0,2) == "49" ) {
        adapter.setObjectNotExists(path + '.state', {
            type: 'state',
            common: {
                name: 'STOP button for ' + devicename,
                desc: 'stop datapoint for blinds for ' + deviceid,
                type: 'boolean',
                role: 'button',
                def: false,
                read: true,
                write: true
            },
            native: {}
        }, function(err, obj) {
            if (!err && obj) {
                adapter.setState(path + 'state', {
                    val: false,
                    ack: true
                });
            }
        });
    }
    
}

function writeStates(result, i) {
    var product = result.devices[i].productName.replace(/\s+/g, ''); // clear whitespaces in product name
    var deviceid = result.devices[i].did;
    var duoferncode = result.devices[i].serial;
    var path = 'devices.' + product + '.' + deviceid + '.';

    adapter.setState(path + 'name', {
        val: result.devices[i].name,
        ack: true
    });
    adapter.setState(path + 'description', {
        val: result.devices[i].description,
        ack: true
    });
    adapter.setState(path + 'duofernCode', {
        val: duoferncode,
        ack: true
    });
    adapter.setState(path + 'status_changed', {
        val: result.devices[i].status_changed,
        ack: true
    });
    adapter.setState(path + 'hasErrors', {
        val: result.devices[i].hasErrors,
        ack: true
    });
    if (result.devices[i].hasErrors > 0) adapter.log.warn('Homepilot Device ' + deviceid + ' reports an error'); // find logic to reduce to one message only
    
    adapter.setState(path + 'productName', {
        val: result.devices[i].productName,
        ack: true
    });
    // STATE
    if (duoferncode.substring(0,2) == "43" || duoferncode.substring(0,2) == "46" || (parseInt(duoferncode.substring(0,2), 16) < 26 && product.indexOf('Repeater') != -1)) { 
        var statevalue = (result.devices[i].position == 100 || result.devices[i].position === '100') ? true : false;
        adapter.setState(path + 'state', {
            val: statevalue,
            ack: true
        }); // maybe should write to adapters level and level_inverted too
    } else if (parseInt(duoferncode.substring(0,2), 16) < 26 && product.indexOf('Repeater') == -1) { // HeizkörperstellantrieZ-Wave
	// TEMP
        adapter.setState(path + 'temperature', {
            val: (parseFloat(result.devices[i].position) * 0.1),
            ack: true
        });
    } else if (duoferncode.substring(0,2) == "E1") {
	// TEMP
        adapter.setState(path + 'temperature', {
            val: (parseFloat(result.devices[i].position) * 0.1),
            ack: true
        });
	} else if (duoferncode.substring(0,2) == "73") {
	// TEMP
        adapter.setState(path + 'temperature', {
            val: (parseFloat(result.devices[i].position) * 0.1),
            ack: true
        });
	// current TEMP
        adapter.setState(path + 'current_temperature', {
            val: (parseFloat(result.devices[i].statusesMap.acttemperatur) * 0.1),
            ack: true
        });
    } else { // LEVEL Datapoints
        adapter.setState(path + 'level', {
            val: result.devices[i].position,
            ack: true
        });
        adapter.setState(path + 'level_inverted', {
            val: 100 - parseInt(result.devices[i].position,10),
            ack: true
        });
    }
    adapter.log.debug('States for ' + product + ' (' + deviceid + ') written');
}

function readHomepilot() {
    var unreach = true;
    request(link, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var result;
            try {
                result = JSON.parse(body);
                var data = JSON.stringify(result, null, 2);
                unreach = false;
                //adapter.log.debug('Homepilot data: ' + data);
                adapter.setState('devices.json', {
                    val: data,
                    ack: true
                });
            } catch (e) {
                adapter.log.warn('Parse Error: ' + e);
                unreach = true;
            }
            if (result) {
                // save val here, go through ALL devices
                for (var i = 0; i < result.devices.length; i++) {
                    //adapter.log.debug('Device ' + result.devices[i].productName + ' found. Name: ' + result.devices[i].name);
                    createStates(result, i); // create Objects if not Exist
                    writeStates(result, i); // write Objects 
                }
                adapter.setState('station.ip', {
                    val: ip,
                    ack: true
                });
            }
        } else {
            adapter.log.warn('Cannot connect to Homepilot: ' + error);
            unreach = true;
        }
        // Write connection status
        adapter.setState('station.UNREACH', {
            val: unreach,
            ack: true
        });
    }); // End request 
    adapter.log.debug('finished reading Homepilot Data');
}

function main() {
    adapter.subscribeStates('*'); 
    //adapter.subscribeStates('*.cid*'); // subscribe command id
    //adapter.subscribeStates('*.level*'); // subscribe all dp with name level
    readSettings();
    adapter.log.debug('Homepilot adapter started...');
    callReadHomepilot = setInterval(function() {
        adapter.log.debug('reading homepilot JSON ...');
        readHomepilot();
    }, sync * 1000);
}
