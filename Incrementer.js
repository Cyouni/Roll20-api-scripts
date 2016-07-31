var Incrementer = (function() {
    'use strict'; 
	var version = 1.00,
		author = "Ryan S.",
		cmdName = "!Incrementer",
		playerSending;
		
	function getCharacterObj(obj) {
		//send any object and returns the associated character object
		//returns character object for attribute, token/graphic, and ability, and... character

		var objType = obj._type,
			att, characterObj, tok;

		if ((objType !== "attribute") && (objType !== "graphic") && (objType !== "character")) {
			sendChat("API"," cannot be associated with a character.");
			return;
		} 

		if ((objType === "attribute") || (objType === "ability")) {
			att = getObj(objType, obj._id);
			if (att.get("_characterid") !== "") {
				characterObj = getObj("character", att.get("_characterid"));
			}
		}

		if (objType === "graphic") { 
			tok = getObj("graphic", obj._id);
			if (tok.get("represents") !== "") {
				characterObj = getObj("character", tok.get("represents"));
			} else {
				sendChat("API"," Selected token does not represent a character.");
				return;
			}
		}

		if (objType === "character") {
			characterObj = getObj("character", obj._id);
		}

		return characterObj;
	}
	
	function sendFeedback(msg) {
		sendChat("Incrementer", "/w " + playerSending + " " + msg); 
	}
	
	function doIncrement(msg) {	
		var args = msg.content.replace(cmdName,'').trim().split(" ");
		var pAmount = parseInt(args[1]);
		
		var tok, characterObj, characterID, characterName;
		
		if (args.length == 2) {	
			_.each(msg.selected, function(obj) {
				tok = getObj("graphic", obj._id);
				// Get the character token represents
				characterObj = getCharacterObj(obj);
				if ( ! characterObj) {
					return;
				}
				characterID = characterObj.get("_id");
				characterName = characterObj.get("name");
				
				var itemNames = filterObjs(function(obj) {    
				  if(obj.get("_type") === 'attribute' && obj.get("_characterid") === characterID && obj.get("name") == args[0]) return true;    
				  else return false;
				});
				
				if (itemNames.length == 0) {
					// handles it if no item by that name is found
					sendFeedback("No attribute by the name " + args[0] + " found."); 
				} else {
					var itemAmount = parseInt(itemNames[0].get('current'));
										
					itemNames[0].set("current", itemAmount + pAmount); 
					//else buffToggle.set("current", 0);
					sendFeedback("Amount set to " + itemNames[0].get("current") + ".");
				}
			});	
		}
	}		
	
	/**
	 * Handle chat messages
	 */
	var handleChatMessage = function(msg) {
		var msgTxt = msg.content;
		var args;
		
		if ((msg.type === "api") 
		&& (msgTxt.indexOf(cmdName) !== -1)) {
			playerSending = msg.who.substring(0, msg.who.indexOf(' ')).trim(); 
			
			args = msgTxt.replace(cmdName,'').trim().toLowerCase();	
			if (args !== "") {
				if (args.indexOf('-help') === 0) {
					sendChat("Incrementer", "/w " + playerSending + " Use !Incrementer \<name\> \<amount\> to increase/decrease a character attribute by that amount.");
				} else {
					doIncrement(msg); 
				}				
			}
		}
	}; 
	
	return {
		/**
		 * Register Roll20 handlers
		 */
		registerAPI : function() {
			on('chat:message',handleChatMessage);
		},

		init: function() {
			
		}
	}; 

}()); 

on("ready", function() {
	'use strict'; 
	Incrementer.init();
	Incrementer.registerAPI();
});
