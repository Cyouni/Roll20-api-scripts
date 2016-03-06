var BuffToggler = (function() {
    'use strict'; 
	var version = 1.00,
		author = "Ryan S.",
		cmdName = "!BuffToggle",
		playerSending
		
	function sendFeedback(msg) {
		sendChat("BuffToggler", "/w gm " + msg); 
	}
	
	function handleBuff(msg) {	
		var args = msg.content.replace(cmdName,'').trim().toLowerCase();	
		
		sendFeedback("\'" + args + "\' parsing.");
		var buffNum = parseInt(args); 
		
		sendFeedback(buffNum + " found.");
		if (!isNaN(buffNum)) {
			if (buffNum > 10 || buffNum < 1) {
				sendFeedback("Buff number " + buffNum + " out of range.");
			}
			var buffName = "@{buff" + buffNum + "_Toggle}";
						
			// toggle buff
			_.each(msg.selected, function(obj) {
				if(obj._type != "graphic") return;
				var token = getObj("graphic", obj._id);
				var character = getObj("character", token.get("represents"));
				
				sendFeedback(character.name + " found.");
				// toggle buff
				var buffToggle = findObjs({
					name: buffName,
					_type: "attribute", 
					_characterid: character.id}, {caseInsensitive: true})[0];
				buffToggle = !buffToggle; 
				sendFeedback("Buff " + buffNum + " toggled.");
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
	
	/**
	 * Handle new graphics added
	 */
	var handleAddGraphic = function(obj) {
		var type;
		var charSheet;
		var charId;
		if (!!(type=obj.get('_subtype'))) {
		   if (type === 'token') {
				charSheet = obj.get('represents');
				if (charSheet) {
					character = getObj("character", charSheet);
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
			on('add:graphic',handleAddGraphic);
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
