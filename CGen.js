	var CreatureGenPF = (function() {
		'use strict'; 
		var version = 1.02,
			author = "Ryan S.",
			contributers = "Ken L., Andy W., Shu Zong C., Carlos R. L. Rodrigues",
			debugLvl = 1,
			locked = false,
			unitPixels = 70,
			workStart = 0,
			workDelay = 250,
			workList = [],
			dmesg,
			warn,
			creName,
			character; 
		
		var blockImg = "[block](http://i.imgur.com/hUV2euG.png)", 
			spellImg = "[spell](http://i.imgur.com/plijFhJ.png)", 
			meleeImg = "[melee](http://i.imgur.com/1QEl2bG.png)", 
			rangedImg = "[ranged](http://i.imgur.com/E1YpHfU.png)", 
			cmbImg = "[cmb](http://i.imgur.com/3mbDizV.png)",
			defenseImg = "[defense](http://i.imgur.com/5n0lw6S.png)", 
			genericImg = "[generic](http://i.imgur.com/H7zQfO6.png)";
		
		var termEnum = Object.freeze({
			GENERAL : 1,
			MONABILITY: 2,
			SPELL: 3,
			FEAT: 4,
			SQ: 5,
			SA: 6,
			SKILL: 7
		}); 
		
		var bonusEnum = Object.freeze({
			SCALAR: 1,
			SIGN: 2
		}); 
		
		var urlCondEnum = Object.freeze({
			FULL: "FULL",
			LABEL: "LABEL"
		}); 
		
		var atkEnum = Object.freeze({
			TITLE: 'TITLE',
			ATTACK: 'ATTACK',
			DAMAGE: 'DAMAGE'
		}); 
		
		/**
		 * Various fields that can be changed for customization
		 * 
		 */
		var fields = {
			defaultName: "Creature",
			publicName: "@{name}",
			publicEm: "/emas ",
			publicAtkEm: "/as Attack ",
			publicDmgEm: "/as Damage ",
			publicAnn: "/desc ",
			privWhis: "/w GM ",
			menuWhis: "/w GM ",
			resultWhis: "/w GM ",
			attackWhis: "",
			urlTermGeneral: '[<<LABEL>>](http://www.google.com/cse?cx=006680642033474972217%3A6zo0hx_wle8&q=<<FULL>>)',
			urlTermMonAbility: '[<<LABEL>>](http://paizo.com/pathfinderRPG/prd/additionalMonsters/universalMonsterRules.html#<<FULL>>)',
			urlTermSpell: '[<<LABEL>>](http://archivesofnethys.com/SpellDisplay.aspx?ItemName=<<FULL>>)',
			urlTermFeat: '[<<LABEL>>](http://archivesofnethys.com/FeatDisplay.aspx?ItemName=<<FULL>>)',
			urlTermSQ: "", // unused
			urlTermSA: "", // unused
			summoner: undefined,
			shortAtkRiders: false // unused
		}; 
		
		var design = {
			feedbackName: 'Ryan S.',
			feedbackImg: 'https://s3.amazonaws.com/files.d20.io/images/3466065/uiXt3Zh5EoHDkXmhGUumYQ/thumb.jpg?1395313520',
			errorImg: 'https://s3.amazonaws.com/files.d20.io/images/7545187/fjEEs0Jvjz1uy3mGN5A_3Q/thumb.png?1423165317',
			warningImg: 'https://s3.amazonaws.com/files.d20.io/images/7926480/NaBmVmKe94rdzXwVnLq0-w/thumb.png?1424965188',
			successImg: 'https://s3.amazonaws.com/files.d20.io/images/7545189/5BR2W-XkmeVyXNsk-C8Z6g/thumb.png?1423165325',
		};
		
		/** 
		 * Object fix to resolve firebase errors 
		 * 
		 * @author Shu Zong C.
		 */
		var fixNewObject = function(obj) {
			// outdated?
			/*var p = obj.changed._fbpath;
			var new_p = p.replace(/([^\/]*\/){4}/, "/");
			obj.fbpath = new_p;*/
			return obj;
		}; 
		
		/**
		 * scan in information from token notes
		 * 
		 * @contribuitor Andy W.
		 */
		var scan = function(token) {
			var charSheet;
			var data;
			var rawData;
			var dispData = "";
			
			if (!token) {
				throw "No Token selected";
			}
			rawData = token.get("gmnotes");
			creLog('RAW: ' + rawData);
			if (!rawData) 
				{throw "no token notes";}
			data = rawData.split(/%3Cbr%3E|\\n|%3C\/p%3E|<br>/);
			
			//clean out all other data except text
			for (var i = data.length; i >= 0; i--) {
				if (data[i]) {
					data[i] = cleanString(data[i]).trim();
					if (!data[i].match(/[^\s]/)) {
						data.splice(i,1); 
					}
				}
			}

			// Essential parameters for object creation (mainly the name)
			parseEssential(data);
			// if character name already exists, close out.
			if (findObjs({
				_type: "character",
				name: creName,
			}).length > 0) {
				addWarning('Character \''+creName+'\' already exists.'); 
				throw 'Character \''+creName+'\' already exists.'; 
			}

			dispData = formatDisplay(data);
			
			charSheet = createObj("character", {
				avatar: token.get("imgsrc"),
				name: creName,
				gmnotes: '',
				archived: false,
				inplayerjournals: '',
				controlledby: ''
			});
			charSheet = fixNewObject(charSheet);
			if (!charSheet) {
				throw "ERROR: could not create character sheet";
			}
			if (fields.summoner) {
				charSheet.set('bio','<br clear="both">' + dispData); 
			}
			
			token.set("represents",charSheet.get('_id'));
			charSheet.set('gmnotes',dispData);
			character = charSheet;
			
			// warn on image source
			if (charSheet.get('avatar') === '') {
				addWarning('Unable to set avatar to character journal, only images you\'ve '
					+ 'uploaded yourself are viable during creation. Auto-population '
					+ '<i>(drag-drop population)</i> will not be possible without an avatar image.'
					+ ' You can still upload an avatar manually, or drag an image into the avatar field'
					+ ' from the image-search.');
			}
			
			
			// parse up our data set.
			var specials;

			try {
				parseCore(data);
				specials = parseSpecials(data);
				parseAttacks(data,specials);
				parseSpells(data);
				parseExtra(data,specials);
				prepToken(token,charSheet);
				
			} catch (e) {
				log("ERROR when parsing");
				throw e;
			}
		}
		
		/**
		 * Format display of stat-block
		 */
		var formatDisplay = function(datum) {
			if (!datum) 
				{return undefined;}
			var content = '';
			
			_.each(datum, function(e,i,l) {
				creLog('('+i+') ' + e,1);
				if (e.match('DEFENSE')
				|| e.match('OFFENSE')
				|| e.match('TACTICS')
				|| e.match('BASE STATISTICS')
				|| e.match('STATISTICS')
				|| e.match('ECOLOGY')
				|| e.match('SPECIAL ABILITIES'))
					{content += '<div style="font-size: 112%; border-bottom: 1px solid black; border-top: 1px solid black; margin-top: 8px;">'+e+'</b></div>';}
				else if (e.match(/\(Ex\)|\(Su\)|\(Sp\)/i))
					{content += '<div>' + e + '</div>';}
				else
					{content += e+'<br>';}
			});
			return content;
		}; 

		/**
		 * Prep the token.
		 * Asynchronous
		 */
		var prepToken = function(token,character) {
			if (!token || !character) 
				{return undefined;}
			var name,AC,hp,prep;
			var charId = character.get('_id');
			
			hp = findObjs({
				_type: "attribute",
				name: "hp",
				_characterid: charId 
			})[0];
			
			AC = findObjs({
				_type: "attribute",
				name: "AC",
				_characterid: charId 
			})[0];
			
			prep = findObjs({
				_type: "attribute",
				name: "CGEN",
				_characterid: charId 
			})[0];
			
			name = character.get('name');
			
			// Fast vs cb delay
			if (token.get('gmnotes')) {
				if (hp && AC && name && prep 
				&& (prep.get('current').match(/true/i))) {
					hp = hp.get('current');
					AC = AC.get('current');
					token.set('bar1_value',hp);
					token.set('bar1_max', hp);
					token.set('bar3_value',AC);
					token.set('name',name);
					token.set('showname',true);
					token.set('light_hassight',true);
					resizeToken(token,character); 
				}
			} else {
				character.get('gmnotes',function(notes) {
					if (hp && AC && name && prep 
					&& (prep.get('current').match(/true/i)) 
					&& notes && (notes !== '')) {
						hp = hp.get('current');
						AC = AC.get('current');
						token.set('bar1_value',hp);
						token.set('bar1_max', hp);
						token.set('bar3_value',AC);
						token.set('name',name);
						token.set('showname',true);
						token.set('light_hassight',true);
						token.set('gmnotes', notes
							.replace(/<div[^<>]*>/g,'')
							.replace(/<\/div>/g,'<br>'));
						resizeToken(token,character); 
					}
				});
			}
		}; 

		/**
		 * Resize Token based on size attribute
		 */
		var resizeToken = function(token,character) {
			var charId = character.get('_id');
			var unitSize = 1.0;
			var pageScale = getObj('page',token.get('_pageid')).get('snapping_increment');
			var tsize = parseInt(unitPixels*(pageScale==0 ? 1:pageScale)); 
			var size = findObjs({
				_type: "attribute",
				name: "Size",
				_characterid: charId 
			})[0];
			if (!size) 
				{return;}

			switch (size.get('current')) {
				case 'Fine':
				case 'Diminutive': 
				case 'Tiny': 
					unitSize = 0.5;
					break;
				case 'Small':
				case 'Medium':
					unitSize = 1;
					 break; 
				case 'Large':
					unitSize = 2; 
					break; 
				case 'Huge':
					unitSize = 3; 
					break; 
				case 'Gargantuan': 
					unitSize = 4; 
					break; 
				case 'Colossal':
					unitSize = 6; 
					break; 
				default:
					 creLog('resizeToken: Bad size \''+size+'\' '); 
			}
			var pSize = parseInt(tsize*unitSize); 
			token.set('width',pSize); 
			token.set('height',pSize); 
		}; 

		var parseEssential = function(data) {
			/* names are tricky as we delimit on CR, last occurance of CR 
			which has numbers after it TODO use a regex which is shorter*/
			var namefield = data[0];
			var delimiter_idx =namefield.lastIndexOf("CR");
			var fuzzyfield = namefield.substring(delimiter_idx,namefield.length);
			if ((delimiter_idx <= 0) || !(fuzzyfield.match(/\d+|—/g)))
				{delimiter_idx = namefield.length;}
			var name = namefield.substring(0,delimiter_idx);
			name = name.trim().toLowerCase().capitalize(); 
			if (name.indexOf("(") != -1) name = name.substring(0, name.indexOf("(")-1);
			
			creName = (fields.summoner ? (fields.summoner.get('_displayname')+'\'s ' + name):name);
			fields.publicName = creName; //(fields.summoner ? creName:fields.publicName);  // ERROR, removed due to screw this
		}; 
		
		/** 
		 * parse core attributes, AC, HP, etc 
		 */
		var parseCore = function(data) {
			if (!data) 
				{return;}

			if (fields.summoner) {
				character.set('controlledby',fields.summoner.get('_id'));
				character.set('inplayerjournals',fields.summoner.get('_id')); 
			}

			var charId = character.get('_id');
			var line = "";
			var lineStartFnd = 0;
			var lineEndFnd = data.length;
			var termChars = [';',','];
			var rc = -1;
			// core attribute fields
			var initAttr = "Init";
			var primeAttr = ["Str","Dex","Con","Int","Wis","Cha"];
			var minorAttr = ["Base Atk","CMB","CMD"];
			var defAttr = ["AC","touch","flat-footed","hp"];
			var saveAttr = ["Fort","Ref","Will"];
			var hp=0,AC=0,tAC=0,ffAC=0;
			
			
			//Flag that this token will be prepped, can be removed by the user
			addAttribute("CGEN",'true','',charId);
			//addAttribute("name",fields.defaultName,'',charId);
			addAttribute("name",creName,'',charId);
			// Init (TODO mythic Init)
			line = getLineByName(initAttr,data);
			rc = getValueByName(initAttr,line,termChars);
			var tempInit = rc.substring(2);
			if (tempInit.length > 1)
				rc += "." + tempInit;
			else 
				rc += ".0" + tempInit;
			
			addAttribute(initAttr,rc,rc,charId);	  
			// prime attributes
			lineStartFnd = getLineNumberByName("STATISTICS",data);
			lineEndFnd = getLineNumberByName("SPECIAL ABILITIES",data);
			line = getLineByName("Str",data,lineStartFnd,lineEndFnd);
			addAttrList(data,line,primeAttr,lineStartFnd,termChars,charId);
			// minor attributes
			line = getLineByName("Base Atk",data,lineStartFnd,lineEndFnd);
			addAttrList(data,line,minorAttr,lineStartFnd,termChars,charId);
			// defense attributes
			lineStartFnd = getLineNumberByName("DEFENSE",data);
			lineEndFnd = getLineNumberByName("OFFENSE",data);
			line = getLineByName("AC",data,lineStartFnd,lineEndFnd);
			addAttrList(data,line,defAttr,lineStartFnd,termChars,charId);
			// save attributes
			line = getLineByName("Fort",data,lineStartFnd,lineEndFnd);
			addAttrList(data,line,saveAttr,lineStartFnd,termChars,charId);
			
			//format attributes:
			hp = formatAttribute("hp",0,charId);
			creLog("parsecore: HP: " + hp,1);
			AC = formatAttribute("AC",0,charId);
			creLog("parsecore: AC: " + AC,1);
			tAC = formatAttribute("touch",0,charId);
			creLog("parsecore: touch AC: " + tAC,1);
			ffAC = formatAttribute("flat-footed",0,charId);
			creLog("parsecore: flat-foot AC: " + ffAC,1);

			// determine size
			var size = parseSize(data);
			creLog("parsecore: size: " + size,1);
			addAttribute('Size',size,size,charId); 
			
			// save riders
			if ((rc=line.indexOf(';')) !== -1) {
				rc = '('+line.substring(rc+1)+')';
			} else {rc = "";}
			
			addAttributeRoll("Init",initAttr,false,true,charId,"&{tracker}");
			addAttributeRoll("Fort","Fort",false,true,charId,rc);
			addAttributeRoll("Ref","Ref",false,true,charId,rc);
			addAttributeRoll("Will","Will",false,true,charId,rc);
			
			
		}; 

		/**
		 * Parse Size of the creature
		 * TODO modify getLineByName and getLineNumberByName to allow regex
		 */
		var parseSize = function(data) {
			var retval = 'Medium'; 
			var lineEndFnd = getLineNumberByName('DEFENSE',data);
			var space = getLineByName('Space',data,getLineNumberByName('OFFENSE',data),getLineNumberByName('STATISTICS',data)); 
			creLog('parseSize: space is ' + space); 
			if (space) {
				space = getValueByName('Space',space,[';',',']); 
				space = getBonusNumber(space,bonusEnum.SCALAR); 
				space = parseInt(space);
				if (isNaN(space))
					{return;}
				space = space/5;
				switch(space) {
					case 1:
						retval = 'Medium'; 
						break;
					case 2:
						retval = 'Large'; 
						break;
					case 3:
						retval = 'Huge'; 
						break;
					case 4:
						retval = 'Gargantuan'; 
						break;
					case 6:
						retval = 'Colossal'; 
						break;
					default:
						retval = 'Medium'; 
						break; 
				}
			} 
			
			if (getLineByName('Fine',data,0,lineEndFnd) || getLineByName('fine',data,0,lineEndFnd)) {
				retval = 'Fine'; 
			} else if (getLineByName('Diminutive',data,0,lineEndFnd) || getLineByName('diminutive',data,0,lineEndFnd)) {
				retval = 'Diminutive'; 
			} else if (getLineByName('Tiny',data,0,lineEndFnd) || getLineByName('tiny',data,0,lineEndFnd)) {
				retval = 'Tiny'; 
			} else if (getLineByName('Small',data,0,lineEndFnd) || getLineByName('small',data,0,lineEndFnd)) {
				retval = 'Small'; 
			} else if (getLineByName('Medium',data,0,lineEndFnd) || getLineByName('Medium',data,0,lineEndFnd)) {
				retval = 'Medium'; 
			} else if (getLineByName('Large',data,0,lineEndFnd) || getLineByName('Large',data,0,lineEndFnd)) {
				retval = 'Large'; 
			} else if (getLineByName('Huge',data,0,lineEndFnd) || getLineByName('huge',data,0,lineEndFnd)) {
				retval = 'Huge'; 
			} else if (getLineByName('Gargantuan',data,0,lineEndFnd) || getLineByName('gargantuan',data,0,lineEndFnd)) {
				retval = 'Gargantuan'; 
			} else if (getLineByName('Colossal',data,0,lineEndFnd) || getLineByName('colossal',data,0,lineEndFnd)) {
				retval = 'Colossal'; 
			}
			return retval; 
		}; 
		
		/**
		 * parse special attacks, if the statblock has 'riders' which give
		 * details on the special abilities, then include it as part of the marco.
		 * TODO: add option for verbrocity during generaton.
		 */
		var parseSpecials = function(data) {
			var retval = {};
			var charId = character.get('_id');
			var line = "";
			var lineStartFnd = 0;
			var lineEndFnd = data.length;
			var re, saName, abName, sAtks, sAtkStr,
				action, actionStr, spList = "", hasSAtks;
			
			line = getLineByName("Special Attacks",data);
			if (line) {
				line = line.replace("Special Attacks",""); 
				sAtks = line.split(/,(?![^\(\)]*\))/);
				while (sAtks.length > 0) {
					if (!sAtks[0] || !sAtks[0].match(/[^\s]+/)) {
						sAtks.shift();
						continue;
					}
					saName = sAtks[0].match(/\b[^\d\(\)\+]+/g);
					if (saName) {
						saName = saName[0].trim();
						sAtkStr += saName;
						if (!retval[saName]) 
							{retval[saName] = new Array(sAtks[0].trim());}
						else 
							{retval[saName].push(sAtks[0].trim());}
						creLog("parseSpecials " + sAtks[0] + " saName: " + saName,1);
					}
					sAtks.shift();
				}
			}
			
			/* TODO add in nextLine support for cases where the special ability
			name is found on the following line(s) */
			lineStartFnd = getLineNumberByName("SPECIAL ABILITIES",data);
			if (lineStartFnd) {
				for (var i = lineStartFnd; i < data.length; ++i) {
					line = data[i];
					if (line.match(/\(Su\)|\(Ex\)|\(Sp\)/i)) {
						saName = line.substring(0,line.indexOf('(')).toLowerCase().trim();
						re = new RegExp(saName,'ig');
						action = "!\n" + fields.menuWhis + 
							line.replace(re,getTermLink(saName,termEnum.GENERAL));
						if (!retval[saName]) 
							{retval[saName] = new Array(line.trim());}
						else 
							{retval[saName].push(line.trim());}
						addAbility("SA-"+saName,"",action,false,charId);
					}
				}
			}
			 
			/* If there is a special attack, that is a special attack not ability, 
			then it is unique and should get its own ability as well as long-rider
			if one exists.*/
			spList = applyBlockTemplate("Special Attacks"); 
			
			// ???
			if (sAtkStr) {
				_.every(_.keys(retval), function(sAtks) {
					if (/*!line.match(sAtks) &&*/ (sAtkStr.indexOf(sAtks) !== -1)) {
						hasSAtks = true;
						abName = "SP-" + sAtks;
						abName = abName.replace(/\s/g,"-");
						action = "!\n" + fields.resultWhis;
						_.every(retval[sAtks], function(rider) {
							creLog("SP rider: " + rider,3);
							re = new RegExp(sAtks,"ig");
							actionStr = "<div>"+getFormattedRoll(rider)+"</div>";
							action += actionStr.replace(re,getTermLink(sAtks,termEnum.GENERAL));
							return true; 
						}); 
						creLog("SP action: " + action,3);
						addAbility(abName,"",action,false,charId);
						spList += makeButton(sAtks, sAtks, abName); 
					}
					return true; 
				});
			}
			if (hasSAtks) {
				addAbility("Specials",'',spList,false,charId);
			}
			return retval;
		}; 
		
		// used to quickly apply block template
		var applyBlockTemplate = function(title) {
			return fields.menuWhis + "&{template:pf_block} {{header_image=" + blockImg + "}} {{character_name=" +
				creName + "}} {{subtitle=" + title + "}}";
		};
		
		/**
		 * parse melee and ranged attacks, if there are special attack riders,
		 * then we will append the marco text 
		 */
		var parseAttacks = function(data,specials) {
			var charId = character.get('_id');
			var line = "";
			var lineStartFnd = 0;
			var lineEndFnd = data.length;
			var atkMenu = "", hasSAtk = false, CMB, riders;
			
			atkMenu = applyBlockTemplate("Attacks"); 
			
			lineStartFnd = getLineNumberByName("OFFENSE",data);
			lineEndFnd = getLineNumberByName("TACTICS",data);
			if (!lineEndFnd)
				{lineEndFnd = getLineNumberByName("STATISTICS",data);}
			try {
				line = getLineByName("Melee",data,lineStartFnd,lineEndFnd);
				if (line) {
					formatAttacks(line,"Melee",charId,"ATK",specials);
					atkMenu += makeButton("Melee", "Melee", "ATK");
				}
				line = getLineByName("Ranged",data,lineStartFnd,lineEndFnd);
				if (line) {
					formatAttacks(line,"Ranged",charId,"RNG",specials);
					atkMenu += makeButton("Ranged", "Ranged", "RNG");
				}
				hasSAtk = findObjs({
						_type: "ability",
						name: "Specials",
						_characterid: charId 
				});
				if (hasSAtk.length > 0) {
					atkMenu += makeButton("Specials", "Specials", "Specials");
				}
				lineStartFnd = getLineNumberByName("STATISTICS",data);
				line = getLineByName("CMB",data,lineStartFnd);
				if (line) {
					CMB = getValueByName("CMB",line,[',',';']);
					riders = CMB.match(/\(.+\)/);
					addAttributeRoll("CMB","CMB",true,false,charId,(riders ? riders:'')); 
					atkMenu += makeButton("CMB", "CMB", "CMB");
				}
				
			} catch (e) {
				log ("ERROR when parsing attacks: ");
				throw e;
			}
			addAbility("Attacks",'',atkMenu,true,charId);
		}; 
		
		/** parse out spells the marco will spit them out, possibly even link 
		 * them to a known PRD search engine.
		 */
		var parseSpells = function(data) {
			var charId = character.get('_id');
			var lineEndFnd = data.length;
			var casterType, attrName;
			var rc, line = "";
			var termChars = [';',','];
			
			lineEndFnd = getLineNumberByName("TACTICS",data);
			if (!lineEndFnd)
				{lineEndFnd = getLineNumberByName("STATISTICS",data);}
			formatSpells("Spell-Like Abilities",data,lineEndFnd,termEnum.GENERAL,"SLA");
			formatSpells("Spells Known",data,lineEndFnd,termEnum.SPELL);
			formatSpells("Spells Prepared",data,lineEndFnd,termEnum.SPELL);
			formatSpells("Extracts Prepared",data,lineEndFnd,termEnum.SPELL);
		}; 
		
		/**
		 * Generic Parse assuming CSV on the line.
		 * 
		 */
		var parseGeneric = function(generic,data,type,start,end) {
			if (!generic || !type) 
				{return undefined;}
			if (!start) 
				{start = 0;}
			if (!end) 
				{end = data.length;}
			var charId = character.get('_id');
			var genName, genRiders, genAry, 
				idx, genList = "", abName, genLabel;
			var lineStartFnd = 0;
			var rc, line = "";
			var termChars = [';'];
					
			genList = applyBlockTemplate(generic); 
				
			line = getLineByName(generic,data,start,end);
			line = getValueByName(generic,line,termChars);
			creLog("parseGeneric: " + line,1);
			if (line) {
				line = line.replace(generic,"");
				line = stripString(line, "*", ""); 
				genAry = line.split(/,(?![^\(\)]*\))/);
				if (genAry) {
					_.every(genAry, function(elemGen) {
						if ((idx=elemGen.indexOf("(")) !== -1) {
							genName = elemGen.substring(0,idx).trim();
							genRiders = elemGen.substring(idx).trim();
						} else {
							genName = elemGen.trim();
							genRiders = undefined;
						}
						genName = formatSuperSubScript(genName);
						genList += "{{" + genName + "=" + getTermLink(genName, type) + (genRiders ? " " + genRiders : "") + "}}";
						return true; 
					}); 
					addAbility(generic,'',genList,false,charId);
				}
			}
		}; 
		
		/** parse out skills the marco will spit them out, possibly even link 
		 * them to a known PRD search engine.
		 */
		var parseSkills = function(data) {
			var charId = character.get('_id');
			var lineStartFnd = 0;
			var lineEndFnd = data.length;
			var skillName, skillRiders, skillAry, 
				skillList = "", abName, skillLabel,
				parts, abStr, racialBonus, racialAry,
				racialRiders;
			var rc, line = "";
			var termChars = [';',','];
			
			skillList = applyBlockTemplate("Skills"); 
			
			lineStartFnd = getLineNumberByName("STATISTICS",data); 
			line = getLineByName("Skills",data,lineStartFnd);
			if (line) {
				line = line.replace("Skills","");
				skillAry = line.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
				if (skillAry.length > 0) {
					_.every(skillAry, function(skill) {
						if (!skill || !skill.match(/[^\s]+/)) {
							creLog("invalid: " + skill,2);
							return true; 
						}
						creLog(skill,4);
						if ((parts=skill.match(/\b[^\d\+\-/]+/)) !== -1) {
							skillName = parts[0].trim();
							creLog('parseSkills: skillName: ' + skillName,5); 
							skillRiders = (skill.substring(skill.indexOf(skillName)+skillName.length)).match(/\(.+\)/);
						}
						if (skillName.match("Racial Modifiers")) {
							creLog("parseSkills: Ending skills, reason : " + skillName,4);
							return false; 
						}
						rc = getBonusNumber(skill);
						skillName = formatSuperSubScript(skillName);
						abName = "SK-" + skillName;
						abName = abName.replace(/\s/g,"-");
						abName = stripString(abName, "(", ''); // strip brackets and spaces out
						abName = stripString(abName, ")", ''); // strip brackets and spaces out
						abName = stripString(abName, " ", ''); // strip brackets and spaces out
						abStr = "!\n" +fields.resultWhis + makeRoll(skillName, rc, skillRiders); 
						addAbility(abName,'',abStr,false,charId);
						skillList += makeButton(abName, skillName, abName);
						return true; 
					}); 
				}
				if (!characterObjExists('SK-Perception','ability',charId)) {
					lineEndFnd = getLineNumberByName('DEFENSE',data);
					line = getLineByName('Perception',data,0,lineEndFnd);
					rc = getValueByName('Perception',line,termChars);
					rc = getBonusNumber(rc,bonusEnum.SIGN);
					abName = "SK-Perception";
					abStr = fields.resultWhis + makeRoll("Perception", rc, skillRiders); 
					addAbility(abName,'',abStr,false,charId);
					skillList += makeButton(skillName, "Perception", abName);
				}
				addAbility("Skills",'',skillList,false,charId);
			}
			
		}; 
		
		
		/**
		 * Parse defenses
		 */
		var parseDefenses = function(data) {
			var retVal;
			var charId = character.get('_id');
			var line = "";
			var lineStartFnd = 0;
			var lineEndFnd = data.length;
			var termChars = [';'];
			var excluded = ['SR','DR','Immune','Resist','Weaknesses'];//TODO compensate for missing delimiters (SR on black dragons vs succubus)
			var rc = -1;
			var i = 0; 
			var SR,DR,CMD,defenseAb,riders, name,
				resist,immune,weak, senses, speed, 
				regen, aura, fasthealing, aryList, hasDefense=false;
			var defenseList = "";

			var fmtLinkFunc = function(arg) {
				arg = arg.trim();
				var name = arg.match(/\b[^\(\)]+/);
				name = formatSuperSubScript(name[0]);
				var riders = arg.match(/\(.+\)/);
				return getTermLink(name,termEnum.GENERAL);
			};
			var fmtLeadFunc = function(arg) {
				var list = arg.split('%%');
				if (list.length !== 2)
					{throw "ERROR: Bad Arg";}
				var label = list[0];
				var riders = list[1].match(/\(.+\)/);
				var value = list[1].match(/\b[^\(\)]+/);
				if (!value) 
					{value = '—';}
				value = value[0].trim();
				return "{{" + label + "=" + value + ((riders) ? " " + riders : "") + "}}";
			};
			var fmtTextFunc = function(arg) {
				var riders = arg.match(/\(.+\)/);
				var value = arg.match(/\b[^\(\)]+/);
				if (!value) 
					{value = '—';}
				value = value[0].trim();
				return value+ ((riders) ? " " + riders : ""); 
			};
			
			defenseList = "!\n" + fields.menuWhis + "&{template:pf_generic} {{header_image=" + defenseImg + "}} {{character_name=" +
				creName + "}} {{subtitle=" + "Defenses" + "}}";
			
			lineStartFnd = getLineNumberByName("DEFENSE",data);
			lineEndFnd = getLineNumberByName("OFFENSE",data);
			line = getLineByName("DR",data,lineStartFnd,lineEndFnd);
			if (line) {DR = getValueByName("DR",line,termChars);}
			line = getLineByName("SR",data,lineStartFnd,lineEndFnd);
			if (line) {SR = getValueByName("SR",line,termChars);}
			line = getLineByName("Immune",data,lineStartFnd,lineEndFnd);
			if (line) {immune = getValueByName("Immune",line,termChars);}
			line = getLineByName("Resist",data,lineStartFnd,lineEndFnd);
			if (line) {resist = getValueByName("Resist",line,termChars);}
			line = getLineByName("Defensive Abilities",data,lineStartFnd,lineEndFnd);
			if (line) {defenseAb = getValueByName("Defensive Abilities",line,termChars);}
			line = getLineByName("Weaknesses",data,lineStartFnd,lineEndFnd);
			if (line) {weak = getValueByName("Weaknesses",line,termChars);}
			// add Fast Healing
			line = getLineByName("fast healing",data,0,lineEndFnd);
			if (line) {fasthealing = getValueByName("fast healing",line,termChars);}
			// add Regeneration
			line = getLineByName("regeneration",data,0,lineEndFnd);
			if (line) {regen = getValueByName("regeneration",line,termChars);}
			// add CMD
			lineStartFnd = getLineNumberByName("STATISTICS",data);
			line = getLineByName("CMD",data,lineStartFnd);
			if (line) {CMD = getValueByName("CMD",line,[',',';']);}
			// add Senses
			lineEndFnd = getLineNumberByName("DEFENSE", data);
			line = getLineByName("Senses",data,0,lineEndFnd);
			if (line) {senses = getValueByName("Senses",line,termChars);}
			// add Aura
			line = getLineByName("Aura",data,0,lineEndFnd);
			if (line) {aura = getValueByName("Aura",line,termChars);}
			// add Speed
			lineStartFnd = getLineNumberByName("OFFENSE", data);
			lineEndFnd = getLineNumberByName("TACTICS",data);
			if (!lineEndFnd) 
				{lineEndFnd = getLineNumberByName("STATISTICS",data);}
			line = getLineByName("Speed",data,lineStartFnd,lineEndFnd);
			if (line) {speed = getValueByName("Speed",line,termChars);}
			
			defenseList += fmtLeadFunc('Touch%%'+findObjs({_type: "attribute", _characterid: character.get('_id'), name: "touch"})[0].get("max"));
			defenseList += fmtLeadFunc('FF%%'+findObjs({_type: "attribute", _characterid: character.get('_id'), name: "flat-footed"})[0].get("max"));
			
			if (CMD) {
				hasDefense = true;
				defenseList += fmtLeadFunc('CMD%%'+CMD);
			}
			
			if (regen) {
				hasDefense = true;
				defenseList += fmtLeadFunc('Regeneration%%'+regen); 
			}

			if (fasthealing) {
				hasDefense = true;
				defenseList += fmtLeadFunc('Fast Healing%%'+fasthealing); 
			}
			
			if (DR || SR) {
				hasDefense = true;
				//if (DR && SR) 
				defenseList += fmtLeadFunc('DR%%'+DR);
				defenseList += fmtLeadFunc('SR%%'+SR);
			}
			
			if (speed) {
				hasDefense = true;
				aryList = speed.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
				defenseList += "{{Speed=";
				if (aryList.length > 0) {
					for (i = 0; i < aryList.length; i++) {
						if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
						 continue;
						}
						defenseList += fmtTextFunc(aryList[i]);
						if (i != aryList.length - 1) defenseList += ", "; 
					}
				}
				defenseList += "}}";		
			}
			
			if (senses) {
				hasDefense = true;
				aryList = senses.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
				defenseList += "{{Senses=";
				if (aryList.length > 0) {
					for (i = 0; i < aryList.length; i++) {
						if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
						 continue;
						}
						defenseList += fmtLinkFunc(aryList[i]);
						if (i != aryList.length - 1) defenseList += ", "; 
					}
				}
				defenseList += "}}";
			}

			if (aura) {
				hasDefense = true;
				aryList = aura.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
				defenseList += "{{Aura=";
				if (aryList.length > 0) {
					for (i = 0; i < aryList.length; i++) {
						if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
						 continue;
						}
						defenseList += fmtLinkFunc(aryList[i]);
						if (i != aryList.length - 1) defenseList += ", "; 
					}
				}
				defenseList += "}}";
			}
			
			if (immune) {
				hasDefense = true;
				aryList = immune.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
				defenseList += "{{Immune=";
				if (aryList.length > 0) {
					for (i = 0; i < aryList.length; i++) {
						if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
						 continue;
						}
						defenseList += fmtLinkFunc(aryList[i]);
						if (i != aryList.length - 1) defenseList += ", "; 
					}
				}
				defenseList += "}}";
			}
			
			if (resist) {
				hasDefense = true;
				aryList = resist.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
				defenseList += "{{Resist=";
				if (aryList.length > 0) {
					for (i = 0; i < aryList.length; i++) {
						if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
						 continue;
						}
						defenseList += fmtLinkFunc(aryList[i]);
						if (i != aryList.length - 1) defenseList += ", "; 
					}
				}
				defenseList += "}}";
			}
			
			if (weak) {
				hasDefense = true;
				aryList = weak.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
				defenseList += "{{Weaknesses=";
				if (aryList.length > 0) {
					for (i = 0; i < aryList.length; i++) {
						if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
						 continue;
						}
						defenseList += fmtLinkFunc(aryList[i]);
						if (i != aryList.length - 1) defenseList += ", "; 
					}
				}
				defenseList += "}}";
			}
			
			if (defenseAb) {
				hasDefense = true;
				aryList = defenseAb.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
				defenseList += "{{Defensive Abilities=";
				if (aryList.length > 0) {
					for (i = 0; i < aryList.length; i++) {
						if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
						 continue;
						}
						defenseList += fmtLinkFunc(aryList[i]);
						if (i != aryList.length - 1) defenseList += ", "; 
					}
				}
				defenseList += "}}";
			}

			if (hasDefense) {
				addAbility("Defenses",'',defenseList,false,charId);
			}
			
		};
		
		/**
		 * Parse out special abilities (not special attacks) and put them in a
		 * menu, if there are no special abilities, create no such menu
		 */
		var parseSpecialMenu = function(data,specials) {
			if (!specials) 
				{return undefined;}
			var charId = character.get('_id');
			var spMenu = "", saName, hasSpecials = false;
			
			spMenu = applyBlockTemplate("SpecialAbilities"); 
			
			_.every(_.keys(specials), function(key) {
				saName = 'SA-' + key;
				if (characterObjExists(saName,'ability',charId)) {
					hasSpecials = true;
					spMenu += makeButton(key, key, saName); 
				}
				return true; 
			}); 
			
			if (hasSpecials)
				{addAbility("Special Abilities",'',spMenu,false,charId);}
		}; 
		
		/**
		 * Parses Gear
		 */
		var parseItems = function(data) {
			var charId = character.get('_id');
			var menu = "", hasGear = false;
			var start, end;
							
			menu = applyBlockTemplate("Items"); 
					
			start = getLineNumberByName("STATISTICS",data);
			end = getLineNumberByName("SPECIAL ABILITIES",data);
					
			// parse Combat Gear
			parseGeneric("Combat Gear",data,termEnum.GENERAL,start,end);
			if (characterObjExists("Combat Gear","ability",charId)) {
				hasGear = true;
				menu += makeButton("Gear-Combat", "Combat Gear", "Combat Gear");
			}
			
			// parse Other Gear
			parseGeneric("Other Gear",data,termEnum.GENERAL,start,end);
			if (characterObjExists("Other Gear","ability",charId)) {
				hasGear = true;
				menu += makeButton("Gear-Other", "Other Gear", "Other Gear");
			}
			if (!hasGear) {
				// parse General Gear
				parseGeneric("Gear",data,termEnum.GENERAL,start,end);
				if (characterObjExists("Gear","ability",charId)) {
					hasGear = true;
					menu += makeButton("Gear", "Gear", "Gear");
				}
			}
			
			if (hasGear)
				{addAbility("Items",'',menu,false,charId);}
		}; 
		
		/**
		 * Parses Tactics
		 */
		var parseTactics = function(data) {
			var charId = character.get('_id');
			var menu = "", hasTactics = false;
			var start, end, line;

			menu = applyBlockTemplate("Tactics"); 
					
			start = getLineNumberByName('TACTICS',data);
			end = getLineNumberByName('STATISTICS',data);
			
			// Before Combat
			line = getLineByName('Before Combat',data,start,end);
			if (line) {
				hasTactics = true;
				line = line.replace('Before Combat','<b>Before Combat</b>');
				line = '!\n' + fields.privWhis + line;
				addAbility('Tactics-Before','',line,false,charId);
				menu += makeButton("BeforeCombat", "Before Combat", "Tactics-Before");
			}
			// During Combat
			line = getLineByName('During Combat',data,start,end);
			if (line) {
				hasTactics = true;
				line = line.replace('During Combat','<b>During Combat</b>');
				line = '!\n' + fields.privWhis + line;
				addAbility('Tactics-During','',line,false,charId);
				menu += makeButton("DuringCombat", "During Combat", "Tactics-During");
			}
			// Morale
			line = getLineByName('Morale',data,start,end);
			if (line) {
				hasTactics = true;
				line = line.replace('Morale','<b>Morale</b>');
				line = '!\n' + fields.privWhis + line;
				addAbility('Tactics-Morale','',line,false,charId);
				menu += makeButton("Morale", "Morale", "Tactics-Morale");
			}

			if (hasTactics)
				{addAbility("Tactics",'',menu,false,charId);}
		}; 
		
		/**
		 * parse additional, non-combat abilities
		 */
		var parseExtra = function(data,specials) {
			var charId = character.get('_id');
			var menu = "", hasExtras = false;
			
			menu = applyBlockTemplate("Abilities"); 
			
			// parse skills
			parseSkills(data);
			if (characterObjExists("Skills","ability",charId)) {
				hasExtras = true;
				menu += makeButton("Skills", "Skills", "Skills");
			}
			// parse feats
			parseGeneric("Feats",data,termEnum.FEAT);
			if (characterObjExists("Feats","ability",charId)) {
				hasExtras = true;
				menu += makeButton("Feats", "Feats", "Feats");
			}
			// parse SQ
			parseGeneric("SQ",data,termEnum.GENERAL);
			if (characterObjExists("SQ","ability",charId)) {
				hasExtras = true;
				menu += makeButton("SQ", "SQ", "SQ");
			}
			// parse Defenses
			parseDefenses(data);
			if (characterObjExists("Defenses","ability",charId)) {
				hasExtras = true;
				menu += makeButton("Defenses", "Defenses", "Defenses");
			}
			// parse Tactics
			parseTactics(data);
			if (characterObjExists("Tactics","ability",charId)) {
				hasExtras = true;
				menu += makeButton("Tactics", "Tactics", "Tactics");
			}
			// parse special abilities
			parseSpecialMenu(data,specials);
			if (characterObjExists("Special Abilities","ability",charId)) {
				hasExtras = true;
				menu += makeButton("SpecialAbilities", "Special Abilities", "Special Abilities");
			}
			// parse items
			parseItems(data);
			if (characterObjExists("Items","ability",charId)) {
				hasExtras = true;
				menu += makeButton("Items", "Items", "Items");
			}
			
			
			if (hasExtras)
				{addAbility("Abilities",'',menu,true,charId);}
		}; 
		
		/** 
		 * A messy area were we parse exceptions such as Base-statistics and 
		 * other rare things that mess up the uniformity of PRD stat blocks.
		 */
		var parseOutlier = function() {
			// Unimplemented
		}; 
		
		/**
		 * Format spells
		 */
		var formatSpells = function(type, data, end, termType, suffix) {
			if (!type || !end || !termType) 
				{return undefined;}
			var charId = character.get('_id');
			var start, casterType, conAttrName, clAttrName,
				sLevel, spells, rc, line, casterLevel,
				concentration, spellBook = "", abName, attrStr;
			var termChars = [';',','];
			
			start = getLineNumberByName(type,data);
			while (start && !!(line=getLineByName(type,data,start,end))) {
				if (line) {
					line = getLineByName(type,data,start,end);
					casterType = line.substring(0,line.indexOf(type)).trim();
					casterType = casterType.replace(/\s+/g,"-");
					if (casterType === "") 
						{casterType = "Base";}
					casterType += (suffix ? ("-"+suffix) : "");
					casterLevel = getValueByName("CL",line,termChars);
					casterLevel = "+" + getBonusNumber(casterLevel,bonusEnum.SCALAR);
					creLog("SpellFormat: casterType: " + casterType,2);
					clAttrName = casterType + "-CL";
					addAttribute(clAttrName,casterLevel,casterLevel,charId);
					attrStr = makeRoll("CL Check", casterLevel);
					addAbility(clAttrName,'',attrStr,false,charId);
					concentration = getValueByName("concentration",line,termChars);
					if (!concentration) {
						addWarning('No concentration bonus found for \''
							+ casterType + '\' ' + type + '. CHA bonus '
							+ 'has been assumed.');	
						var lineStartFnd = getLineNumberByName("STATISTICS",data);
						var lineEndFnd = getLineNumberByName("SPECIAL ABILITIES",data);
						var statLine = getLineByName("Str",data,lineStartFnd,lineEndFnd);
						var cha = getValueByName("Cha", statLine, []);
						cha = getBonusNumber(cha, bonusEnum.SCALAR);
						var chaBonus = Math.floor((cha-10)/2);
						var concentrationNum = getBonusNumber(casterLevel,bonusEnum.SCALAR) + getBonusNumber(chaBonus.toString(),bonusEnum.SCALAR);
						concentration = concentrationNum.toString(); 
					}
					concentration = getBonusNumber(concentration,bonusEnum.SIGN);
					conAttrName = casterType + "-CON";
					addAttribute(conAttrName,concentration,concentration,charId);
					attrStr = makeRoll("Concentration", (concentration ? concentration:'+?{concentration-bonus}'));
					addAbility(conAttrName,'',attrStr,false,charId);
					start++;

					spellBook = applyBlockTemplate(casterType); 

					creLog("ParseSpells: start: " + start + " line: " + line,1);
					// mow down some lines wherever we see —, stop when we don't see it.
					for (var i = start; i < end; ++i) {
						line = data[i];
						creLog("formatSpells: line " + line,2);
						if (line.match("—")) {
							spells = line.split("—");
							if (spells.length < 2)
								{throw "ERROR: Bad spell list format";}
							sLevel = spells[0];
							sLevel = stripString(sLevel, "(", "- "); 
							sLevel = stripString(sLevel, ")", ""); 
							
							spells = spells[1].split(/,(?![^\(\)]*\))/);
							creLog("spells sl: " + sLevel + " sp: " + spells,2);
							addSpells(casterLevel,sLevel,spells,termType,casterType,charId);
							abName = casterType + " " + sLevel;
							spellBook += makeButton(sLevel, sLevel, abName);
						} else 
							{break;}
					}
					if (casterType) {
						// put in CL and CON check buttons
						spellBook += makeButton("CL", "CL Check", clAttrName) + makeButton("Concentration", "Concentration", conAttrName); 
						abName = casterType;
						addAbility(abName,'',spellBook,true,charId);
					}
					/* Should be safe if we're under the assumption that there is at
					lease one ability given the stat block defined that it has abilities
					of this type */
					start = getLineNumberByName(type,data,start+1,end);
				}
			}
		}; 
		
		/**
		 * add spells, be wary of greater/lesser semantics..
		 */
		var addSpells = function(casterLevel,spellLvl, spellAry, termType, setName, charId) {
			if (!spellLvl || !spellAry || !setName || !termType || !charId) 
				{return undefined;}
			var spellName, spellRiders, spellLabel, idx, 
				abName;
			var spellList = "";
			
			spellList = "!\n" + fields.menuWhis + "&{template:pf_block} {{header_image=" + spellImg + "}} {{character_name=" +
				creName + "}} {{name=" + setName + "}} {{subtitle=" + spellLvl + " (CL" + casterLevel + ")}} {{" + spellAry[0].trim() + "=";
			
			while (spellAry.length > 0) {
				if (!spellAry[0] || !spellAry[0].match(/[^\s]+/)) {
					spellAry.shift();
					continue;
				}
				spellAry[0] = spellAry[0].trim();
				if ((idx=spellAry[0].indexOf("(")) !== -1) {
					spellName = spellAry[0].substring(0,idx).trim();
					spellRiders = spellAry[0].substring(idx).trim();
				} else {
					spellName = spellAry[0].trim();
					spellRiders = undefined;
				}
				// elminate badly formatted trailing commas
				if (spellName === "" || !spellName)
					{throw 'ERROR: bad spell name: ' + spellName;}
				// Invert to treat special names, link to the base spell in the label
				spellName = formatSuperSubScript(spellName);
				spellLabel = formatSpellStrength(spellName);
				creLog("spell name: " + spellName + " spellRiders: " + spellRiders,2);
				
				//d20pfsrd uses - rather than %20
				//spellLabel = spellLabel.replace(/\s+/g,"-");
				spellList += getTermLink(spellLabel,termType,spellName) + (spellRiders ? " " + spellRiders : "");
				if (spellAry.length > 1) spellList += ", ";
				spellAry.shift();
			}
			spellList += "}}";
			abName = setName + " " + spellLvl;
			
			// check to see if it exists before adding it, for weird dupes
			var spellsFound = findObjs({
				_type: "ability",
				name: abName,
				_characterid: charId
			});
			if (spellsFound.length > 0) { 
				var subtitleSearch = "{{subtitle=" + spellLvl + " (CL" + casterLevel + ")}}";
				spellList = spellList.substring(spellList.indexOf(subtitleSearch) + subtitleSearch.length, spellList.length); 
				spellsFound[0].set('action', spellsFound[0].get('action') + spellList);
			} else {
				addAbility(abName,'',spellList,false,charId);
			}
		}; 
		
		/**
		 * A fancy way of saying, 'deal with greater/lesser/(numearl) for spell names'.
		 * this is for term linking as the PRD and PFSRD refer to a single page for all
		 * strength varients.
		 */
		var formatSpellStrength = function(spellName) {
			if (!spellName) 
				{return undefined;}
			var retval = spellName;
			var strengths = ["mass","lesser","greater"];
			var levels = ["IX","VIII","VII","VI","IV","V","III","II","I"];
			
			// strip strengths
			_.every(strengths, function(level) {
				if (spellName.indexOf(level) !== -1) {
					retval = spellName.replace(level,"").trim();
					return false; 
				}
				return true; 
			}); 
			//strip levels
			_.every(levels, function(level) {
				if (spellName.indexOf(level) !== -1) {
					retval = spellName.replace(level,"").trim() + " 1";
					return false; 
				}
				return true; 
			}); 
			return retval;
		}; 
		
		/**
		 * Given a string which we recognize as a legal name (spell/feat/whatever)
		 * and, which we suspect may have a superscript or subscript; remove it.
		 */
		var formatSuperSubScript = function(str) {
			if (!str) 
				{return undefined;}
			var retval = str;
			var cases = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th",
				"UM","TG","UC","APG","MC","D","B"];
			var endsWith = function (str, suffix) {
				return str.indexOf(suffix, str.length - suffix.length) !== -1;
			}; 
			
			_.every(cases, function(subscript) {
				if (endsWith(str,subscript)) {
					retval = str.replace(subscript,"").trim();
					return false; 
				}
				return true; 
			}); 
			
			return retval;
		}; 
		
		/**
		 * Format attacks 
		 */
		var formatAttacks = function(str, type, charId, label, specials) {
			if (!str || !type || !charId) 
				{return undefined;}
			if (!label) 
				{label = type;}
			var volley, attacks, atkList = "";
			var cnt = 0;
			var alphabet = ['A','B','C','D','E','F','G','H','I','J','K','L','M',
				'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

			atkList = applyBlockTemplate(type); 

			str = str.replace(type,"").trim();
			str = str.replace(/\band\b/g,',');
			volley = str.split(/\bor\b/g);
			if (volley.length > 1) {
				while (volley.length > 0) {
					if (!volley[0] || !volley[0].match(/[^\s]+/)) {
						volley.shift();
						continue;
					}
					if (alphabet.length <= 0) 
						{alphabet.unshift(++cnt);}
					attacks = volley[0].split(/,(?![^\(\)]*\))/);
					atkList += addAttacks(attacks,type,charId,label,specials,alphabet[0]);
					volley.shift();
					alphabet.shift();
				}
			} else {
				attacks = str.split(/,(?![^\(\)]*\))/);
				atkList += addAttacks(attacks,type,charId,label,specials);
			}

			addAbility(label,'',atkList,false,charId);
		}; 
		
		var calcCritDamage = function(atkDamage, multi) {
			var numDamage = atkDamage;
			var toMult = parseInt(multi)-1; 
			var numDice = numDamage.substring(numDamage.indexOf('[[')+2, numDamage.indexOf('d')).trim();
			var isPlus = '+';
			
			var plusMinus = numDamage.indexOf('+') !== -1 ? numDamage.indexOf('+') : numDamage.indexOf('-');
			
			var bonus; 
			if (plusMinus === -1) {
				plusMinus = numDamage.indexOf(']]'); 
				bonus = 0;
			} else {
				isPlus = numDamage.charAt(plusMinus);
				bonus = numDamage.substring(plusMinus+1, numDamage.indexOf(']]')).trim();
			}
			var dieSize = numDamage.substring(numDamage.indexOf('d')+1, plusMinus).trim();
			
			
			var result;
			result = "[[" + (parseInt(numDice)*toMult) + "d" + dieSize + isPlus + (parseInt(bonus)*toMult) + "]]"; 
			return result;
		};
		
		/**
		 * Adds attacks
		 */
		var addAttacks = function(aryList, type, charId, label, specials, volley) {
			if (!aryList || !label || !charId) 
				{return undefined;}
			var attack, atkName, atkMod,
				atkRiders, atkDamage, atkIter,
				critRange, critDamage, atkStr, dmgStr,
				abName, abLabel = '', iterCnt = 0, 
				atkTitle;
			var codeName;
			
			creLog('addAttacks: ' + aryList + " " + label + " " + volley,1);
				
			for (var i = 0; i < aryList.length; i++) {
				if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
					log("cont");
					continue;
				}
				attack = aryList[i].trim();
				atkName = attack.match(/\b[^\d\(\)\+\/×]+(?=\+|\-)/);
				if (!atkName) {
					/* if we don't have an attack name, we either don't have 
						a modifier or there's a modifier with no name..*/
					/* if there is no modifier, the name spans from 0,
						to the first paren, absorb the rider into the
						name if any; if there's no paren cough up the error ghost.
						If there is a modifier, then append a default name*/
					if (attack.substring(0,attack.indexOf('(')).match(/\+\-/)) {
						atkName = "Basic " + label + " ";
						attack = atkName + attack;
					} else {
						atkName = attack.substring(0,attack.indexOf('(')).trim();
					}
				} else {
					atkName = attack.substring(
						0,attack.indexOf(atkName[0])+atkName[0].length).trim();
				}
				// Ensure there's a damage section
				if (attack.match(/\(.+\)/)) {
					atkMod = attack.substring(atkName.length,attack.indexOf('(')-1).trim();
					atkDamage = attack.substring(attack.indexOf('(')+1,attack.indexOf(')'));
					atkRiders = atkMod.match(/\b[^\d\(\)\+\-\/×]+/);
				} else {
					atkMod = getBonusNumber(attack);
					atkDamage = "0";
				}
				
				critRange =getCritRange(atkDamage);
				atkDamage = formatDamage(atkDamage,specials);
				critDamage = calcCritDamage(atkDamage.damage, critRange.multi); 
				creLog('addAttacks: got damage for ' + attack,1); 
				
				// set up the template
				atkTitle = "!\n" + fields.publicAnn + fields.publicName + " attacks with " + atkName + "!";
				atkStr = "\n" + fields.attackWhis + "&{template:pf_attack}"; 
				if (type == "Melee") {
					atkStr += "{{header_image=" + meleeImg + "}}";
				} else if (type == "Ranged") {
					atkStr += "{{header_image=" + rangedImg + "}}";
				}
				atkStr += "{{character_name=" + creName + "}} {{name=" + atkName + "}}";	
				
				// do iteratives:
				atkIter = atkMod.split('/');
				if (atkIter && atkIter.length > 1) {
					while(atkIter.length > 0) {
						++iterCnt;

						// critRange.range, critRange.multi		
						atkStr += "{{attack" + ((iterCnt != 1) ? iterCnt : "") + "=[[1d20"+(critRange.range<20 ? ("cs>"+critRange.range) : '') + atkIter[0] + "]]" 
							+ (!atkRiders ? '' : ( " " + atkRiders[0].trim()))
							+ "}}";
						// define damage	atkDamage = formatDamage(atkDamage,specials);
						atkStr += "{{damage" + ((iterCnt != 1) ? iterCnt : "") + "=" + atkDamage.damage + "}}";
						atkStr += "{{crit_confirm" + ((iterCnt != 1) ? iterCnt : "") + "=[[1d20" + atkIter[0] + "]]" 
							+ (!atkRiders ? '' : ( " "+atkRiders[0].trim()))
							+ "}}";
						atkStr += "{{crit_damage" + ((iterCnt != 1) ? iterCnt : "") + "=" + critDamage + "}}";
						
						atkIter.shift();
					}
				} else {
					var numAttacks = parseInt(atkName); 
					numAttacks = ((!isNaN(numAttacks) && atkName[0] != '+') ? numAttacks : 1); 
					
					for (var j = 1; j <= numAttacks; j++) {
						atkStr += "{{attack" + ((j > 1) ? j : "") + "=[[1d20"+(critRange.range<20 ? ("cs>"+critRange.range) : '') + atkIter[0] + "]]" 
								+ (!atkRiders ? '' : ( " "+atkRiders[0].trim()))
								+ "}}";
							// define damage	atkDamage = formatDamage(atkDamage,specials);
						atkStr += "{{damage" + ((j > 1) ? j : "") + "=" + atkDamage.damage + "}}";
						atkStr += "{{crit_confirm" + ((j > 1) ? j : "") + "=[[1d20" + atkIter[0] + "]]" 
								+ (!atkRiders ? '' : ( " "+atkRiders[0].trim()))
								+ "}}";
						atkStr += "{{crit_damage" + ((j > 1) ? j : "") + "=" + critDamage + " }}";
					}
					
					// bonus attack for AOOs and whatnot
					if (numAttacks > 1) {
						var bonusAtkName = atkName.substring(atkName.indexOf(' ')+1, atkName[atkName.length-1] == 's' ? atkName.length-1 : atkName.length); 
						var bonusAtkStr = "!\n" + fields.publicAnn + fields.publicName + " attacks with " + bonusAtkName + "!" +
							"\n" + fields.attackWhis + "&{template:pf_attack}"; 
						if (type == "Melee") {
							bonusAtkStr += "{{header_image=" + meleeImg + "}}";
						} else if (type == "Ranged") {
							bonusAtkStr += "{{header_image=" + rangedImg + "}}";
						}
						bonusAtkStr += "{{character_name=" + creName + "}} {{name=" + bonusAtkName + "}}";
						bonusAtkStr += "{{attack" + "=[[1d20"+(critRange.range<20 ? ("cs>"+critRange.range) : '') + atkIter[0] + "]]" 
								+ (!atkRiders ? '' : ( " "+atkRiders[0].trim()))
								+ "}}";
								
						bonusAtkStr += "{{damage" + "=" + atkDamage.damage + "}}";
						bonusAtkStr += "{{crit_confirm" + "=[[1d20" + atkIter[0] + "]]" 
								+ (!atkRiders ? '' : ( " "+atkRiders[0].trim()))
								+ "}}";
						bonusAtkStr += "{{crit_damage" + "=" + critDamage + "}}";
						bonusAtkStr += (atkDamage.rider==="" ? '': atkDamage.rider);
						
						var bonusCodeName = label + "_AOO" + (volley ? ("_"+volley) : '') + "_" + bonusAtkName;
						var bonusAbName = label + "_AOO" + (volley ? '_'+volley : '') + "_" + bonusAtkName;
						addAbility(bonusAbName,'',bonusAtkStr,false,charId);
						abLabel += makeButton(bonusAtkName + (volley ? volley : ''), bonusAbName, bonusCodeName);
					}
				}
				atkStr += (atkDamage.rider==="" ? '': atkDamage.rider);
				
				// set name and add ability
				codeName = label + (volley ? ("&#40;"+volley+"&#41;") : '') + "_" + atkName;
				abName = label + (volley ? ("("+volley+")") : '') + "_" + atkName;
				
				addAbility(abName,'',atkTitle+atkStr,false,charId);
				abLabel += makeButton(atkName + (volley ? volley : ''), abName, codeName);
				creLog('addAttacks: ' + attack + " atkname: '" + atkName + "' atkmod: '" + atkMod + "' atkDam: '"
					+ atkDamage + "' atkRiders: '" + atkRiders + "'",1);
			}
			creLog('addAttacks: finished attacks for ' + label,1); 
			
			return abLabel;
		}; 
		
		/**
		 * Gets the crit range from the damage string.
		 */
		var getCritRange = function(str) {
			if (!str) 
				{return {range: 20, multi: 2};}
			var retval, multi = 2,range = 20,tmp = "";
			var terms = str.split("/");
			
			if (terms && terms.length > 0) {
				for (var i = 0; i < terms.length; ++i) {
				if (terms[i].match(/×\d+/)) {
						multi = terms[i].match(/\d+/g);
						if (!multi) 
							{multi = 2;}
					} else if ((tmp=terms[i].match(/\b\d+\-\d+/))) {
						range = tmp[0].match(/\d+/g);
						if (!range) 
							{range = 2;}
					}	
				}
			}
			
			retval = {
				range: parseInt(range),
				multi: parseInt(multi)
			};
			return retval;
		}; 
		
		/**
		 * Format the damage string and attach any riders if any. Be careful about
		 * subrider semantics.
		 */
		var formatDamage = function(str, specials) {
			if (!str) 
				{return {damage: "", rider: ""};}
			var retval;
			var damage, damageStr="", damageExpr, 
				damageTypes,riders,riderStr="",ploc = -1,tmp;
			var re = /\d+d\d+/;
			
			creLog("formatDamage str: " + str,2);
			damage = re.exec(str);
			ploc = str.indexOf('plus');
			
			// if flat, or rider only damage section
			if (!damage) {
				if (ploc !== -1) {
					damageStr = str.substring(0,ploc).match(/\b[\d]+\s/);
					if (!damageStr) {
						damageStr = str.match(/\b[^\d\/\(\)\+×\s]+\b/);
						creLog("damageStr: " + damageStr,3);
						if (!damageStr) // give up if things get too weird
							{throw "ERROR: Bad damage format: '" + str + "'";}
						str = str.substring(0,ploc+4)
							+ ' ' + damageStr[0].trim() + ','
							+ str.substring(ploc+4);
					}
				} else if (!!(damageStr = str.match(/\b[^\d\/\(\)\+×\s]+\b/))) {
					str = str + " plus " + damageStr[0].trim();
				}
				damageStr = '[[0d0]]'; 
			} else {
				damageExpr = getExpandedExpr(damage[0],str,damage.index).trim();
				damageStr = getFormattedRoll(damageExpr);
				// handle damage type
				damageTypes = str.match(/\b[^\d\/\(\)\+×]+\b/);
				if (damageTypes) {
					/* In the case where we have a type we need to get rid of the critical
						expression */
					creLog("formatDamage Types: " + damageTypes,3);
					if (!str.match("plus")) {
						tmp = str.indexOf('/');
						tmp = str.substring(str.indexOf(damageExpr)+damageExpr.length,
							(tmp===-1 ? str.length:tmp)).trim();
						damageStr += " " + tmp;
					} else {
						tmp = str.indexOf('/');
						tmp = str.substring(str.indexOf(damageExpr)+damageExpr.length,
							(tmp===-1 ? ploc:tmp)).trim();
						damageStr += " " + tmp;
					}
				}
			}

			// handle riders
			if (str.match("plus")) {
				riders = str.substring(str.indexOf("plus"));
				creLog("riders are: " + riders,3);
				riders = riders.replace("plus","");
				var ary = riders.split(/,(?![^\(\)]*\))/);
				var riderName;
				var subRiders;
				creLog('ary: ' + ary);
				while (ary && ary.length > 0) {
					if (!ary[0] || !ary[0].match(/[^\s]+/)) {
						ary.shift();
						continue;
					}
					riderName = ary[0].match(/\b[^\d\/\(\)\+×]+/);
					// resolve unlabed/typed damage riders
					if (!riderName) {
						riderName = 'untyped';
						ary[0] = riderName + ary[0];
					} else {
						riderName = riderName[0];
					}
					subRiders = ary[0].replace(riderName,'').trim();
					riderName = riderName.toLowerCase().trim();
					creLog("ary val: " + ary[0],4);
					creLog("subrider: " + subRiders + " riderName: " + riderName,4);
					creLog("specials: " + specials[riderName],4);
					if (!specials) {
						riderStr += "\n" + fields.privWhis + getTermLink(riderName,termEnum.GENERAL) + " "+(subRiders.match(/[^\s]+/) ? (" "+getFormattedRoll(subRiders)) : '');
					} else {
						riderStr += "\n" + fields.privWhis + ((specials[riderName] ? getFormattedRoll(getDamageRiderInfo(riderName,specials)) : undefined) || getTermLink(riderName,termEnum.GENERAL))
								+ " "+(subRiders.match(/[^\s]+/) ? (" "+getFormattedRoll(subRiders,termEnum.GENERAL)) : '');
					}
					ary.shift();
				}
			}
			creLog("formatDamage: " + damageStr + " riders: " + riderStr,1);
			retval = {
				damage: damageStr,
				rider: riderStr
			};
			return retval;
		}; 
		
		/**
		 * Gets all damage rider information
		 */
		var getDamageRiderInfo = function(riderName,specials) {
			var retval = "";
			var riderInfo;
			var re;
			if (specials) {
				riderInfo = specials[riderName];
				creLog("RiderInfo: " + riderInfo,3);
				if (riderInfo) {
					while(riderInfo.length > 0) {
						re = new RegExp("\\b"+riderName+"\\b",'ig');
						riderInfo[0] = riderInfo[0].replace(
							re,getTermLink(riderName,termEnum.GENERAL)+" ");
						retval += "<p>" + riderInfo[0] + "</p>" ;
						creLog("RiderInfoLine: " + retval,3);
						riderInfo.shift();
					}
				}
			}
			return retval;
		}; 
		
		/**
		 * Format an attribute by the type desired:
		 * 0 - scalar, grab the first number
		 * 1 - pos/neg, grab the first number as well as the sign if any
		 */
		var formatAttribute = function(name, type, charId) {
			if (!name || !charId) 
				{return undefined;}
			if (!type) 
				{type = 0;}
			var retval = 0;
			var attr;
			
			attr = findObjs({
					_type: "attribute",
					name: name,
					_characterid: charId 
			})[0];
			
			if (!attr) {
				throw "Error: no attribute found '" + name + "'";
			}
			retval = attr.get("current");
		  
			switch (type) {
				case 0:
					retval = retval.match(/\d+/g)[0];
					break;
				case 1:
					retval = getBonusNumber(retval);
					break;
			}
			creLog("formatAttribute: " + retval +	" n: " + name + " t: " + type + " c: " + charId,2);
				
			attr.set('current',retval);
			attr.set('max',retval);
			return retval;
		}; 
		
		/**
		 * Add an attribute to a character
		 */
		var addAttribute = function(name, curVal, maxVal, charId) {
			if (!curVal)
				//{throw 'Cannot add ' + name + ' with no value';}
				{curVal = '';}
			if (!maxVal)
				{maxVal = '';}
			
			creLog("addAttribute: " + name + " " + curVal + " " + maxVal + " " + charId,2);
				
			createObj("attribute", {
					name: name,
					current: curVal,
					max: maxVal,
					characterid: charId
				});
		}; 
		
		/**
		 * Add an ability to a character
		 */
		var addAbility = function(name, desc, action, isTokenAct, charId) {
			createObj("ability", {
				name: name,
				description: desc,
				action: action,
				istokenaction: isTokenAct,
				characterid: charId
				});
		}; 
		
		/**
		 * Add an ability roll from an attribute
		 */
		var addAttributeRoll = function(name, attrName, isPublic, isTokenAction, charId, rider) {
			if (!name,!attr,!charId) 
				{return undefined;}
			if (!isPublic) 
				{isPublic = false;}
			var action = "";
			var attr = findObjs({
					_type: "attribute",
					name: attrName,
					_characterid: charId 
			})[0];
			if (!attr) {
				throw ("Error: no attribute found \'" + name + "\'");
			}
			
			action = "!\n" + (isPublic ? "" /*fields.resultAnn*/ : fields.resultWhis) + 
				makeRoll(attrName, getBonusNumber(attr.get('current')), rider);
				
			addAbility(name,"",action,isTokenAction,charId);
		}; 
		
		/**
		 * Given a line containing the most attributes, add them to the
		 * character
		 */
		var addAttrList = function(data,line, aryList, startFnd, termChars, charId) {
			if (!aryList || !termChars || !charId) 
				{return undefined;}
			if (!line) 
				{line = data[0];}
			if (!startFnd) 
				{startFnd = 0;}
			var rc; 
			
			creLog("addAttrList: " + startFnd + " " + termChars + " " + charId + " " + line + " " + (!!aryList),3);
			while(aryList.length > 0) {
				rc = getValueByName(aryList[0],line,termChars);
				if (!rc) {
					var nextBestLine = getLineByName(aryList[0],data,startFnd);
					rc = getValueByName(aryList[0],nextBestLine,termChars);
					if (!rc) {
						throw ("ERROR: could not find attribute " + aryList[0]);
					}
				}
				addAttribute(aryList[0],rc,rc,charId);
				aryList.shift();
			}
		}; 
		
		/**
		 * Return a link whose format depends on type
		 */
		var getTermLink = function(str,type,label) {
			if (!str || !type) 
				{return undefined;}
			if (!label) 
				{label = str;}
			var retval = str;
			switch(type) {
				case termEnum.GENERAL:
					retval = getFormattedUrl(str,fields.urlTermGeneral,label);
					break;
				case termEnum.SPELL:
					str = str.capitalize(); 
					retval = getFormattedUrl(str,fields.urlTermSpell,label);
					break;
				case termEnum.FEAT:
					retval = getFormattedUrl(str,fields.urlTermFeat,label);
					break;
				case termEnum.SQ:
					retval = getFormattedUrl(str,fields.urlTermSQ,label);
					break;
				case termEnum.SA:
					retval = getFormattedUrl(str,fields.urlTermSA,label);
					break;
				default:
					retval = str;
			}
			creLog("getTermLink: " + retval,3);
			return retval;
		}; 

		/**
		 * Return a formatted URL by filling in placeholders. with str and label
		 */
		var getFormattedUrl = function(str,url,label) {
			if (!str || !url) 
				{return undefined;}
			if (!label) 
				{label = str;}
			var retval;
			var re = /<<\w+>>/g;
			var matches, cond;
			
			creLog("formatting str: '" + str + "' on url: '" + url + "'",4);
			if ((matches=url.match(re))) {
				while (matches.length > 0) {
					creLog("formaturl: " + matches[0],5);
					matches[0] = matches[0].replace(/<<|>>/g,"");
					if ((cond=matches[0].match(/\D+/))) {
						creLog("formaturl word: " + cond[0],5);
						switch(cond[0]) {
							case urlCondEnum.FULL:
								url=url.replace("<<"+urlCondEnum.FULL+">>",str);
								break;
							case urlCondEnum.LABEL:
								url=url.replace("<<"+urlCondEnum.LABEL+">>",label); 
								break;
							default:
								creLog("unsupported url subsitution: " + matches[0],1);
						}
						
					} else if ((cond=matches[0].match(/\d+/))) {
						cond = parseInt(cond);
						creLog("formaturl char: " + cond,5);
						if (cond < str.length) 
							{url=url.replace("<<"+matches[0]+">>",str[cond]);}
						else
							{creLog("illegal string index of " + cond + " in '" + str + "'",1);}
					}
					matches.shift();
				}
			}
			retval = url;
			creLog("formattedUrl: " + retval,4);
			return retval;
		}; 

		/**
		 * Get the bonus number in the string, carefully looking for signs to
		 * preserve negatives and what not. TODO there's a Regex solution to this
		 * which is way shorter.. also add type for scalars.
		 */
		var getBonusNumber = function(str,type) {
			if (!str) 
				{return 0;}
			if (!type) 
				{type = bonusEnum.SIGN;}
			var retval = 0;
			var locStart = 0;
			var locEnd = str.length;
			var num;
		
			str = str.replace(/\s/g,"");
			switch (type) {
				case bonusEnum.SCALAR:
					num = str.match(/\d+([\/.]\d+)?/g);
					if (num)
						{retval = parseFloat(num[0]);}
					else
						{retval = "0";}
					break;
				case bonusEnum.SIGN:
					num = str.match(/\+*\-*\d+([\/.]\d+)?/g);
					if (num) {
						if (!num[0].match(/\+|\-/))
							{retval = "+" + num[0];}
						else
							{retval = num[0];}
					} else
						{retval = "+0";}
					break;
				default:
					// impossible
					return undefined;
			}
			
			return retval;
		}; 
		
		/**
		 * Return the string with the roll formatted, this is accomplished by simply
		 * surrounding roll equations with [[ ]] TODO, should be replaced with a
		 * single regex
		 * 
		 */
		var getFormattedRoll = function(str) {
			if (!str) 
				{return "";}
			var retval = str;
			var re = /\d+d\d+/;
			var idx, expr, roll, pre, post;

			if (!!(roll=re.exec(str))) {
				expr = getExpandedExpr(roll[0],str,roll.index);
				idx = str.indexOf(expr);
				pre = str.substring(0,idx);
				post = str.substring(idx+expr.length);
			} else { return str;}
			
			return pre+"[["+expr+"]]"+getFormattedRoll(post);
		}; 
		
		/**
		 * Return the target expression expanded as far as it logically can span
		 * within the provided line.
		 * 
		 * ie: target = 1d20
		 *	   locHint = 4
		 *	   line = "2+1d20+5+2d4 bla (bla 1d20+8 bla) bla (4d8...) bla bla"
		 * 
		 * result = 2+1d20+5+2d4
		 */
		var getExpandedExpr = function(target, line, locHint) {
			if (!target || !line) 
				{return undefined;}
			if (!locHint) 
				{locHint = 0;}
			var retval = target;
			var expr = target;
			var re = /\d|[\+\-]|d/;
			var loc = -1, start = 0, end = 0;
			
			if((loc=line.indexOf(target,locHint)) !== -1) {
				start = loc;
				while (start > 0) {
					if (line[start].match(re))
						{start--;}
					else
						{start++;break;}
				}
				end = loc;
				while (end < line.length) {
					if (line[end].match(re))
						{end++;}
					else
						{break;}
				}
				retval = line.substring(start,end);
				creLog("getExpandedExpr: '" 
						+ retval + "' s: " + start + " e: " + end + " t: " + target + " l: " + line,4);
				retval = getLegalRollExpr(retval);
			}
			
			return retval;
		}; 
		
		/**
		 * Gets a legal roll expression.
		 * TODO strip trailing operands +1d6 and such
		 */
		var getLegalRollExpr = function(expr) {
			if (!expr) 
				{return undefined;}
			var retval = expr;
			var stray = expr.match(/d/g);
			var valid = expr.match(/\d+d\d+/g);
			var errMsg = "Illegal expression " + expr;
			
			try {
				if (expr.match(/[^\s\d\+-d]/g) 
				|| !stray 
				|| !valid 
				|| (stray.length =! valid.length))
					{throw errMsg;}
				stray = expr.match(/\+/g);
				valid = expr.match(/\d+\+\d+/g);
				if (stray && valid
				&& (stray.length !== valid.length))
					{throw errMsg;}
				stray = expr.match(/-/g);
				valid = expr.match(/\d+-\d+/g);
				if (stray && valid
				&& (stray.length !== valid.length))
					{throw errMsg;}
			} catch (e) {
				creLog(e,1);
				throw e;
			}
			
			//check for leading, trailing, operands
			if (retval[0].match(/\+|\-/))
				{retval = retval.substring(1);}
			if (retval[retval.length-1].match(/\+|\-/))
				{retval = retval.substring(0,retval.length-1);}
			
			creLog("getLegalRollExpr: " + retval,4);
			return retval;
		}; 
		
		/**
		 * Given a name, array of lines, and a start/end location, find the first 
		 * line that contains the given name.
		 */
		var getLineByName = function(strName, aryLines, locStart, locEnd) {
			creLog('getLineByName: name ' + strName + ' data ' + !!aryLines,5); 
			if (!strName || !aryLines) 
				{return undefined;}
			if (!locStart) 
				{locStart = 0;}
			if (!locEnd) 
				{locEnd = aryLines.length;}
			var retval;
			
			creLog("getLineByName: " + strName + " " + locStart + " " + locEnd + " " + (!!aryLines),5);
			for (var i = locStart; i < locEnd; ++i) {
				if (aryLines[i].indexOf(strName) !== -1) {
					retval = aryLines[i];
					break;
				}
			}
			creLog('getLineByName: name ' + strName + ' value \'' + retval,5); 
			return retval;
		}; 

		/**
		 * Given a name, array of lines, and a start/end location, find the first
		 * line # that contains the given name.
		 */
		var getLineNumberByName = function(strName, aryLines, locStart, locEnd) {
			if (!strName || !aryLines) 
				{return undefined;}
			if (!locStart) 
				{locStart = 0;}
			if (!locEnd) 
				{locEnd = aryLines.length;}
			var retval = -1;
			
			creLog("getLineNumberByName: " + strName + " " + locStart + " " + locEnd + " " + (!!aryLines),5);
			for (var i = locStart; i < locEnd; ++i) {
				if (aryLines[i].indexOf(strName) !== -1) {
					retval = i;
					break;
				}
			}
			
			// backup in case it's lowercase
			if (retval === -1) {
				var strUpper = strName.toLowerCase().capitalize(); 
				creLog("getLineNumberByName: " + strUpper + " " + locStart + " " + locEnd + " " + (!!aryLines),5);
				for (var i = locStart; i < locEnd; ++i) {
					if (aryLines[i].indexOf(strUpper) !== -1) {
						retval = i;
						break;
					}
				}
			}
			
			if (retval === -1) { // revert in case of error
				var blank; 
				return blank;
			}	
			return retval;
		}; 
		
		/**
		 * Given a line, name, and terminators return the value, value is
		 * the the trimed text after the name and before the terminator.
		 */
		var getValueByName = function(strName, strLine, termChars) {
			if (!strLine || !strName || !termChars) 
				{return undefined;}
			var retval;
			var loc = -1;
			var locTerm = strLine.length;
			
			creLog("getValueByName: " + strName + " " + termChars + " " + strLine,5);
			if ((loc=strLine.indexOf(strName)) !== -1) {
				for (var i = 0; i < termChars.length; ++i) {
					var tmp = strLine.indexOf(termChars[i],loc);
					if ((tmp !== -1) && (tmp < locTerm)) 
						{locTerm = tmp;}
				}
				if (locTerm > loc) {
					locTerm = getParenSafeTerm(
						strLine,loc,locTerm,termChars);
					retval = strLine.substring(loc+strName.length,locTerm);
				}
			}
			return retval;
		}; 
		
		/**
		 * Get the location of the closest terminator that is paren safe. If there
		 * are parens. Probably a faster way exists using regex and exec..
		 */
		var getParenSafeTerm = function(strLine, start, end, termChars) {
			var newTerm = -1;
			var inParen = 0;
			var closeLoc = -1;
			var i; 
			
			if (start >= end) 
				{return end;}
			for (i = start; i < strLine.length; ++i) {
				if (strLine[i] === '(')
					{inParen++;}
				else if (strLine[i] ===')')
					{inParen--;}
				if (i >= end) {
					if (inParen <= 0) 
						{return end;}
					else if (inParen > 0) 
						{break;}
				}
			}
			if (inParen <= 0) 
				{return end;}
			
			// if we found we're in parens
			creLog("in parens for " + strLine + " openparens: " + inParen,5);
			closeLoc = strLine.indexOf(')',start);
			end = strLine.length;
			if (closeLoc === -1) 
				{return end;}
			for (i = 0; i < termChars.length; ++i) {
				if (-1 === (newTerm=strLine.indexOf(termChars[i],closeLoc)))
					{newTerm = strLine.length;}
				else if (newTerm < end)
					{end = newTerm;}
			}
			return end;
		}; 
		
		/**
		 * check if the character object exists, return first match
		 */
		var characterObjExists = function(name, type, charId) {
			var retval;
			var obj = findObjs({
				_type: type,
				name: name,
				_characterid: charId 
			});
			creLog("type: " + type + " name: " + name + " charId: " + charId + " retval: " + obj,5);
			if (obj.length > 0)
				{retval = obj[0];}
			return retval;
		}; 
		
		/** removes all occurence of removeStr in str and replaces them with 
		 * replaceWidth
		 * 
		 * @author Andy W.
		 */
		var stripString = function(str, removeStr, replaceWith) {
			while (str.indexOf(removeStr) !== -1) {
				str = str.replace(removeStr, replaceWith);
			}
			return str;
		}; 

		/**
		 * Cleans the string preserving select special characters and dropping the
		 * remainder.
		 * 
		 * @author Andy W.
		 * @contributor Ken L.
		 */
		var cleanString = function(strSpecials) {
			strSpecials = stripString(strSpecials, "%20", ' ');
			strSpecials = stripString(strSpecials, "%22", '"');
			strSpecials = stripString(strSpecials, "%29", ')');
			strSpecials = stripString(strSpecials, "%28", '(');
			strSpecials = stripString(strSpecials, "%2C", ',');
			strSpecials = stripString(strSpecials, "%42", '');
			strSpecials = stripString(strSpecials, "*", '');
			strSpecials = stripString(strSpecials, '\n', '');
			strSpecials = stripString(strSpecials, '%3Cbr', '');
			
			strSpecials = stripString(strSpecials, "%09", '	');
			strSpecials = stripString(strSpecials, "%3C", '<');
			strSpecials = stripString(strSpecials, "%3E", '>');
			strSpecials = stripString(strSpecials, "%23", '#');
			strSpecials = stripString(strSpecials, "%3A", ':');
			strSpecials = stripString(strSpecials, "%3B", ';');
			strSpecials = stripString(strSpecials, "%3D", '=');
			strSpecials = stripString(strSpecials, "%D7", '×');
			strSpecials = stripString(strSpecials, "%u2018", '');
			strSpecials = stripString(strSpecials, "%u2019", '');
			strSpecials = stripString(strSpecials, "%u2013", '-');
			strSpecials = stripString(strSpecials, "%u2014", '—');
			strSpecials = stripString(strSpecials, "%u201C", '“');
			strSpecials = stripString(strSpecials, "%u201D", '”');
			
			
			while (strSpecials.search(/%../) !== -1) {
				strSpecials = strSpecials.replace(/%../, "");
			}
			
			strSpecials = strSpecials.replace(/<[^<>]+>|<\/[^<>]+>/g,'');
			//strSpecials = strSpecials.replace(/<(?:.|\n)*?>/gm, '');		what does this do?
			return strSpecials;
		}; 
		
		var makeButton = function(tag, buttonName, abName) {
			creLog("making button for " + buttonName + " with " + abName);
			return "{{" + tag + "=[" + buttonName + "](!&#13;&#37;&#123;" + creName + "&#124;" + abName + "&#125;)}}";
		}
		
		var makeRoll = function(rollName, modifier, riders) {
			creLog("making roll for " + rollName + " with +" + modifier);
			return "&{template:pf_generic} {{header_image=" + genericImg + "}} {{character_name=" +
				creName + "}} {{name=" + rollName + "}} {{Check=[[1d20" 
				+ modifier + (riders ? " "+riders:"") + "]]}}";
		}
		
		String.prototype.capitalize = function() {
			return this.replace(/\b\w/g, function(txt){
				return txt.charAt(0).toUpperCase();
			});
		}
		
		/**
		 * Logging, store it
		 */
		var creLog = function(msg, lvl) {
			if (!msg) 
				{return undefined;}
			if (!lvl) 
				{lvl = 1;}
			if (dmesg) {
				dmesg.push('['+lvl+']:' + " " + msg);
			} else {
				dmesg = new Array('['+lvl+']:' + " " + msg);
			}
		}; 
		
		/**
		 * Dump it.
		 */
		var creLogDump = function(lvl) {
			if (dmesg) {
				log('--- Dumping log at level ['+lvl+'] ---');
				_.every(dmesg, function(line) {
					var clvl = line.match(/\d+/);
					if (clvl && (parseInt(clvl[0].trim()) <= lvl))
						{log(line);}
					return true; 
				}); 
				log('--- Log dump at level ['+lvl+'] complete ---');
			} else {log("No log found");}
		}; 
		
		/**
		 * Add warnings
		 */
		var addWarning = function(msg) {
			if (warn)
				{warn.push(msg);}
			else
				{warn = new Array(msg);}
		}; 
		
		/**
		 * Send warnings
		 */
		var sendWarnings = function(token,msg) {
			var content = '';
			if (warn) {
				_.every(warn, function(elem) {
					content += '<p>' 
						+ '<span style="color: #FF9100; font-weight: bold">Warning: </span>'
						+ elem + '</p>'; 
					return true; 
				}); 
				content += (msg ? msg:''); 
				sendFeedback(content,design.warningImg,token.get('imgsrc'));
			}
		}; 

		/**
		 * get warning block
		 */
		var getWarningBlock = function(msg) {
			var content = '';
			if (warn) {
				_.every(warn, function(elem) {
					content += '<p>' 
						+ '<span style="color: #FF9100; font-weight: bold">Warning: </span>'
						+ elem + '</p>'; 
					return true; 
				}); 
				content += (msg ? msg:''); 
				//return getFeedbackBlock(content,design.warningImg,token.get('imgsrc'));
				return content; 
			}
		}; 
		
		/**
		 * Fake message is fake!
		 */
		var sendFeedback = function(msg,img,tokenImg) {
			var content = '/w GM '
					+ '<div style="position: absolute; top: 4px; left: 5px; width: 26px;">'
						+ '<img src="' + '">' 
					+ '</div>'
					+ msg;
			if (tokenImg && img) {
				content = content
					+ '<div style="position: relative">'
						+ '<div style="position: relative; width: 70px; height: 70px; overflow: hidden;">'
							+ '<img src="' + tokenImg + '" style="position: relative; width: 70px; height: 70px;">'
						+ '</div>'
						+ '<div style="position: absolute; top: 0px; width: 70px; height: 70px;">'
							+ '<img src="' + img + '" style="position: relative;">'
						+ '</div>'
					+ '</div>';
			}
			
			sendChat("Ryan S.",content);
		}; 

		/**
		 * Fake message block
		 */
		var getFeedbackBlock = function(msg,img,tokenImg) {
			var content = msg;
			if (tokenImg && img) {
				content +=
					'<div>'
						+ '<div style="display: inline-block; position: relative; width: 70px; height: 70px; overflow: hidden;">'
							+ '<img src="' + tokenImg + '" style="position: relative; width: 70px; height: 70px;">'
						+ '</div>'
						+ '<div style="display: inline-block; position: absolute; left: 45px; width: 70px; height: 70px; overflow: hidden;">'
							+ '<img src="' + img + '" style="position: relative;">'
						+ '</div>'
					+ '</div>';
			}
			return content; 
		}; 
		
		/**
		 * Performs Genesis with a default name other than 'Creature''
		 */
		var doNameGenesis = function(msg, name) {
			if (!msg || !name) 
				{return undefined;}
			var originalDefaultName = fields.defaultName;
			
			fields.defaultName = name;
			doGenesis(msg);
			fields.defaultName = originalDefaultName;
		}; 
		
		/**
		 * Performs Genesis granting control to a player
		 */
		var doPlayerGenesis = function(msg, playerName) {
			if (!msg || !playerName) 
				{return undefined;}
			var players;
			var name;
			var targets = [];
			var targetName;
			var targetPlayer;
			var levDiff = 0;
			var minDiff = 255; // good enough
			var originalMenuWhis = fields.menuWhis;
			var originalResultWhis = fields.resultWhis;
			var originalName = fields.publicName;
			var originalPublicAnn = fields.publicAnn;
			var re = new RegExp(playerName,'i');
			players = findObjs({
				_type: "player",
			});
			
			_.every(players, function(elem) {
				name = elem.get('_displayname').toLowerCase();
				if (name.match(re)) {
					targets.push(elem);
				}
				return true; 
			}); 
			
			if (targets.length < 1) {
				sendFeedback('Could not find player: ' + playerName);
				return undefined;
			} else if (targets.length === 1) {
				targetName = targets[0].get('_displayname').toLowerCase();
				targetPlayer = targets[0];
			} else {
				targetName = targets[0].get('_displayname').toLowerCase();
				_.every(targets, function(elem) {
					name = elem.get('_displayname').toLowerCase();
					levDiff = getLev(playerName,name);
					if (levDiff < minDiff) {
						minDiff = levDiff;
						targetName = name;
						targetPlayer = elem;
					}
					return true; 
				}); 
			}
			fields.menuWhis = '/w "'+targetName+'" ';
			fields.resultWhis = '';
			fields.publicAnn = '';
			fields.summoner = targetPlayer;
			doGenesis(msg);
			var pgenWork = function(args) {
				fields.summoner = undefined;
				fields.publicAnn = originalPublicAnn;
				fields.publicName = originalName;
				fields.resultWhis = originalResultWhis;
				fields.menuWhis = originalMenuWhis;
			}	
			workList.push({workFunc: pgenWork}); 
		}; 
		
		var getLev = function(s1, s2, cost_ins, cost_rep, cost_del) {
		//		 discuss at: http://phpjs.org/functions/levenshtein/
		//		original by: Carlos R. L. Rodrigues (http://www.jsfromhell.com)
		//		bugfixed by: Onno Marsman
		//		 revised by: Andrea Giammarchi (http://webreflection.blogspot.com)
		// reimplemented by: Brett Zamir (http://brett-zamir.me)
		// reimplemented by: Alexander M Beedie
		// reimplemented by: Rafał Kukawski
		//		  example 1: levenshtein('Kevin van Zonneveld', 'Kevin van Sommeveld');
		//		  returns 1: 3
		//		  example 2: levenshtein("carrrot", "carrots");
		//		  returns 2: 2
		//		  example 3: levenshtein("carrrot", "carrots", 2, 3, 4);
		//		  returns 3: 6
			var LEVENSHTEIN_MAX_LENGTH = 255; // PHP limits the function to max 255 character-long strings
	  
			cost_ins = cost_ins === undefined ? 1 : +cost_ins;
			cost_rep = cost_rep === undefined ? 1 : +cost_rep;
			cost_del = cost_del === undefined ? 1 : +cost_del;

			if (s1 === s2) {
				return 0;
			}

			var l1 = s1.length;
			var l2 = s2.length;
	  
			if (l1 === 0) {
				return l2 * cost_ins;
			}
			if (l2 === 0) {
				return l1 * cost_del;
			}
	  
			// Enable the 3 lines below to set the same limits on string length as PHP does
			/*if (l1 > LEVENSHTEIN_MAX_LENGTH || l2 > LEVENSHTEIN_MAX_LENGTH) {
				return -1;
			}*/

			// BEGIN STATIC
			var split = false;
			try {
				split = !('0')[0];
			} catch (e) {
				// Earlier IE may not support access by string index
				split = true;
			}
			// END STATIC
			if (split) {
				s1 = s1.split('');
				s2 = s2.split('');
			}

			var p1 = new Array(l2 + 1);
			var p2 = new Array(l2 + 1);

			var i1, i2, c0, c1, c2, tmp;
	  
			for (i2 = 0; i2 <= l2; i2++) {
				p1[i2] = i2 * cost_ins;
			}
	  
			for (i1 = 0; i1 < l1 ; i1++) {
				p2[0] = p1[0] + cost_del;
		
				for (i2 = 0; i2 < l2; i2++) {
					c0 = p1[i2] + ((s1[i1] === s2[i2]) ? 0 : cost_rep);
					c1 = p1[i2 + 1] + cost_del;
		  
					if (c1 < c0) {
						c0 = c1;
					}
		  
					c2 = p2[i2] + cost_ins;
		  
					if (c2 < c0) {
						c0 = c2;
					}
		  
					p2[i2 + 1] = c0;
				}
		
				tmp = p1;
				p1 = p2;
				p2 = tmp;
			}
	  
			c0 = p1[l2];
	  
			return c0;
		}; 
		
		/**
		 * "And then the GM said, let there be monsters!" 
		 * 
		 * Performs Creature Generation
		 */
		var doGenesis = function(msg) {
			var token;
			var content = ''; 

			if (!(msg.selected && msg.selected.length > 0)) {
				sendFeedback("no token selected for creature creation");
				return;
			}

			if (msg.selected.length > 1) {
				sendFeedback( '<div style="font-weight: bold; color: #7AB6FF; font-size: 150%">' 
					+ 'Starting group generation</div>');
			}
			locked = true; 
			workStart = Date.now(); 

			_.each(msg.selected, function(e) {
				var genesisWork = function(e) {
					token = getObj('graphic', e._id);
					if ((token && (token.get('_subtype') !== 'token')) || !token) {
						sendFeedback(
							'<span style="font-weight: bold; color: #FF0000;">Invalid Selection</span>'
							+ (msg.selected.length > 1 ? ('<div style="color: black; font-style: italic; font-weight: bold;">('+(msg.selected.length-workList.length+1)+'/'+msg.selected.length+')</div>'):'')
							); 
						return;
					}
					try {
						dmesg = undefined;
						warn = undefined;
						scan(token);
						sendFeedback(
							(warn ? getWarningBlock():'')
							+ '<span style="font-weight: bold; color: '+(warn ? '#FF9100':'#08AF12')+';">' 
							+ token.get('name')
							+ '</span>' 
							+ ' has been generated ' + (warn ? 'with warnings.':'successfully!')
							+ (msg.selected.length > 1 ? ('<div style="color: black; font-style: italic; font-weight: bold;">('+(msg.selected.length-workList.length+1)+'/'+msg.selected.length+')</div>'):''),
							(warn ? design.warningImg:design.successImg),
							token.get('imgsrc'));
						//creLogDump(5);
						character = undefined;
					} catch (err) {
						log("GENESIS ERROR: " + err);
						sendFeedback(
							(warn ? getWarningBlock():'')
							+ '<span style="font-weight: bold; color: #FF0000;">' 
							+ 'There was an error during token generation.' 
							+ '</span> '
							+ 'Please see the log for details, and delete the erroneous journal entry.'
							+ (msg.selected.length > 1 ? ('<div style="color: black; font-style: italic; font-weight: bold;">('+(msg.selected.length-workList.length+1)+'/'+msg.selected.length+')</div>'):''),
						design.errorImg,
						token.get("imgsrc"));
						creLogDump(debugLvl);
						warn = undefined;
						character = undefined;
						log("-----Please ensure that the statistics block is properly formatted.-----"); 
					}
				}; 

				workList.push({workFunc: genesisWork, workData: [e]}); 
			},this); 

			if (msg.selected.length > 1) {
				workList.push({workFunc: function() {
					var tTime = (Date.now() - workStart)/1000; 
					sendFeedback(
						'<div style="font-weight: bold; color: #08AF12; font-size: 150%">' 
						+ 'Group generation complete </div>'
						+ '<div style="color: blue; font-size: 100%; font-style: italic: font-weight: bold">(Time elapsed: '+tTime.toFixed(2)+'s)</div>');
					locked = false; 
				}, workData: []}); 
			} else {
				locked = false; 
			}

			doDelayedWork(workList); 
		}; 

		/**
		 * Delayed Worktask
		 */ 
		var doDelayedWork = function() {
			if (!workList || !workList.length)
				{return;}

			var payload = workList.shift();
			if (!payload)
				{return;}
			payload.workFunc.apply(undefined,payload.workData); 
			setTimeout(doDelayedWork,workDelay); 
		}; 

		
		/**
		 * Show help
		 */
		var showHelp = function() {
			var content;
			var designTmpList = "";
			var attackTmpList = "";
			
			if (typeof(CGTmp) !== "undefined") {
				try {
					_.every(_.keys(CGTmp.designTmp), function(tmp) {
						designTmpList += '<div>' + '<a href="!CreatureGen -set-design ' + tmp + '">' + tmp + ' </a></div>';
						return true; 
					}); 
					_.every(_.keys(CGTmp.attackTmp), function(tmp) {
						attackTmpList += '<div>' + '<a href="!CreatureGen -set-attack ' + tmp + '">' + tmp + ' </a></div>';
						return true; 
					}); 
				} catch (ex) {
					log("ERROR accessing CGTmp: " + e);
					designTmpList = "";
					attackTmpList = "";
				}
			}
			content = '<div style="background-color: #FFFFFF; border: 1px solid black; left-margin 5x; right margin 5px; padding-top: 5px; padding-bottom: 5px;;">'
						+ '<div style="border-bottom: 1px solid black;">'
							+ '<span style="font-weight: bold; font-size: 150%">CreatureGen v'+version+'</span>'
						+ '</div>'
						+ '<div style="padding-left: 10px; padding-right: 10px;">'
							+ '<div>'
								+ '<span style="font-weight: bold;">!CreatureGen -help</span>'
							+ '</div>'
							+ '<li style="padding-left: 10px;">'
								+ 'Display this message'
							+ '</li>'
							+ '<div>'
								+ '<span style="font-weight: bold;">!CreatureGen</span>'
							+ '</div>'
							+ '<li style="padding-left: 10px;">'
								+ 'Generate creature'
							+ '</li>'
							+ '<div>'
								+ '<span style="font-weight: bold;">!CreatureGen -name [name]</span>'
							+ '</div>'
							+ '<li style="padding-left: 10px;">'
								+ 'Generate creature with the given default name'
							+ '</li>'
							+ '<div>'
								+ '<span style="font-weight: bold;">!CreatureGen -player [name]</span>'
							+ '</div>'
							+ '<li style="padding-left: 10px;">'
								+ 'Generate player controlled creature (a summon)'
							+ '</li>'
							+ '<div>'
								+ '<span style="font-weight: bold;">!CreatureGen -set-design [name]</span>'
							+ '</div>'
							+ '<div style="float: right; margin-left 2px; padding-top: 2px; padding-bottom: 2px; padding-left: 2px; padding-right: 2px; border: 1px solid black; background-color: #89FEBA; text-align: center; font-weight: bold;">'
								+ (state.cgen_design ? state.cgen_design : "Default")
							+ '</div>'
							+ '<li style="padding-left: 10px;">'
								+ 'Set design template'
							+ '</li>'
							+ (designTmpList==='' ? '' : '<div style="border: 1px solid blue; text-align: center;"><span style="text-decoration: underline;">Available design templates:</span>')
								+ designTmpList
							+ (designTmpList==='' ? '' : '</div>')
							+ '<div>'
								+ '<span style="font-weight: bold;">!CreatureGen -set-attack [name]</span>'
							+ '</div>'
							+ '<div style="float: right; margin-left 2px; padding-top: 2px; padding-bottom: 2px; padding-left: 2px; padding-right: 2px; border: 1px solid black; background-color: #89FEBA; text-align: center; font-weight: bold;">'
								+ (state.cgen_attack ? state.cgen_attack : "Default")
							+ '</div>'
							+ '<li style="padding-left: 10px;">'
								+ 'Set attack template'
							+ '</li>'
							+ (attackTmpList==='' ? '' : '<div style="border: 1px solid blue; text-align: center;"><span style="text-decoration: underline;">Available attack templates:</span>')
								+ attackTmpList
							+ (attackTmpList==='' ? '' : '</div>')
							+ '<div>'
								+ '<span style="font-weight: bold;">!CreatureGen -dmesg [lvl]</span>'
							+ '</div>'
							+ '<li style="padding-left: 10px;">'
								+ 'Dump to API-output console debug at the specified level (1-5) for the last token generated.'
							+ '</li>'
						+ '</div>'
						
						+ '</div>'
					+ '</div>';
			sendFeedback(content);
		}; 
		
		/**
		 * Handle chat messages
		 */
		var handleChatMessage = function(msg) {
			var cmdName = "!CreatureGen";
			var msgTxt = msg.content;
			var args;
			if ((msg.type === "api") 
			&& (msgTxt.indexOf(cmdName) !== -1)
			&& playerIsGM(msg.playerid)) {
				args = msgTxt.replace(cmdName,'').trim().toLowerCase();
				if (args !== "") {
					if (locked) {
						sendFeedback('<span style="color: #FF8D0B; font-weight: bold;">'
							+ ' BUSY </span>');
					} else if (args.indexOf('-help') === 0) {
						showHelp();
					} else if (args.indexOf('-dmesg') === 0) {
						var level = 0;
						args = args.replace('-dmesg','').trim();
						level = getBonusNumber(args,bonusEnum.SCALAR);
						creLogDump(level);
						sendFeedback('<span style="color: #FF8D0B;">'
							+ 'Dumping debug from last <b>GENESIS</b> at level ('+level+')'
							+ '</span>');
					} else if (args.indexOf('-player') === 0) {
						args = args.replace('-player','').trim();
						doPlayerGenesis(msg,args);
					} else if (args.indexOf('-name') === 0) {
						args = args.replace('-name','').trim();
						doNameGenesis(msg,args);
					} else if (args.indexOf('-hideattacks') === 0) {
						fields.attackWhis = "/w GM ";
						doGenesis(msg);
					} else {
						sendFeedback("Unknown CreatureGen command '"+args+"'");
						showHelp();
					}
					
				} else if (locked) {
					sendFeedback('<span style="color: #FF8D0B; font-weight: bold;">'
						+ ' BUSY </span>');
				} else {
					fields.attackWhis = "";
					doGenesis(msg);
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
						charSheet = getObj("character", charSheet);
						if (charSheet) {
							prepToken(obj,charSheet);
						}
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
				var rc = true;
			}
		}; 

	}()); 



	on("ready", function() {
		'use strict'; 
		CreatureGenPF.init();
		CreatureGenPF.registerAPI();
	});