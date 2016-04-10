var BuffToggler = (function() {
    'use strict'; 
	var version = 1.00,
		author = "Ryan S.",
		cmdName = "!BuffToggle",
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
		sendChat("BuffToggler", "/w " + playerSending + " " + msg); 
	}
	
	function handleBuff(msg) {	
		// calculate buff number
		var args = msg.content.replace(cmdName,'').trim().toLowerCase();	
		var buffNum = parseInt(args); 
		
		var tok, characterObj, characterID, characterName;
		
		if (!isNaN(buffNum)) {
			if (buffNum > 10 || buffNum < 1) {
				sendFeedback("Buff number " + buffNum + " out of range.");
			}
						
			// toggle buff
			_.each(msg.selected, function(obj) {
				tok = getObj("graphic", obj._id);
				// Get the character token represents
				characterObj = getCharacterObj(obj);
				if ( ! characterObj) {
					return;
				}
				characterID = characterObj.get("_id");
				characterName = characterObj.get("name");
				
				var buffNames = filterObjs(function(obj) {    
				  if(obj.get("_type") === 'attribute' && obj.get("_characterid") === characterID && obj.get("name").match(/repeating_buff_[^_]+_buff-name/)) return true;    
				  else return false;
				});
				var buffList = filterObjs(function(obj) {    
				  if(obj.get("_type") === 'attribute' && obj.get("_characterid") === characterID && obj.get("name").match(/repeating_buff_[^_]+_buff-enable_toggle/)) return true;    
				  else return false;
				});
				var buffName = buffNames[buffNum].get('current'); 
				var buffToggle = buffList[buffNum]; 
										
				if (buffToggle.get("current") == 0) buffToggle.set("current", 1); 
				else buffToggle.set("current", 0);
				sendFeedback(buffName + " toggled to " + Boolean(buffToggle.get("current")) + ".");
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
					sendChat("BuffToggler", "/w " + playerSending + " Use !BuffToggle \<number\> to enable/disable a buff.");
				} else {
					handleBuff(msg); 
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
	BuffToggler.init();
	BuffToggler.registerAPI();
});
