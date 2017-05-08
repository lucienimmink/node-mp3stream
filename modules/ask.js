var CommandAsker = require('command-asker'),
    fs = require('fs'),
    dblite = require('dblite'),
    config = require('./../config.json');

module.exports = function() {
    var a = new CommandAsker([{
            key: 'port',
            ask: 'On which port do you want to listen? '
        },
        {
            key: 'ssl',
            ask: 'Do you want to use SSL? (yes/no)'
        },
        {
            key: 'path',
            ask: 'Where are the music files stored? '
        },
        {
            key: 'username',
            ask: 'What username do you want to use to authenticate? ',
            required: true
        },
        {
            key: 'password',
            ask: 'What password do you want to use ? ',
            required: true
        }
    ]);

    a.ask(function(response) {
        // set the new config file
        config.ask = false;
        config.port = response.port;
        config.path = response.path;
        config.useSSL = (response.ssl.toLowerCase() === 'yes' || response.ssl.toLowerCase() === 'true' || response.ssl === 1) ? true : false;
        fs.writeFileSync('./config.json', JSON.stringify(config));

        // setup the Database
        var db = dblite('./users.db');
        db.query("CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT)", function(err, res) {
            db.query('INSERT OR REPLACE INTO users VALUES(?, ?)', [response.username, response.password], function(err, res) {
                console.log("Config and user database has been set-up. Restart the app to start streaming.");
                if (config.useSSL) console.info("Please update the paths of the SSL cert and key. Most likely you have to restart the app as root");
                db.close();
                a.close();
            });
        });
    });
};