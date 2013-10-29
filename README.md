node-mp3stream
==============

A simple mp3 streamer based on node.js; for security reasons you need a sqlite3 database holding the basic user info for people that are allowed to stream. The db has the following setup:
- Table 'users'
	- field 'username' (String)
	- field 'password' (String)
Please create the database file and place it in the same folder as node-mp3stream; or remove the authentication lines from the code; though this is not recommended for internet connected devices.
