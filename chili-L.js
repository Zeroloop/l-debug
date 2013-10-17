/*
===============================================================================
Chili is the jQuery code highlighter plugin
...............................................................................
LICENSE: http://www.opensource.org/licenses/mit-license.php
WEBSITE: http://noteslog.com/chili/

											   Copyright 2008 / Andrea Ercolino
===============================================================================
*/


( function($) {

LChiliBook = { //implied global

	  version:            "2.2" // 2008-07-06

// options --------------------------------------------------------------------

	, automatic:          true
	, automaticSelector:  "div.debug div.results code"

	, lineNumbers:        !true

	, codeLanguage:       function( el ) {
		var recipeName = $( el ).attr( "class" );
		return recipeName ? recipeName : '';
	}

	, recipeLoading:      true
	, recipeFolder:       "" // used like: recipeFolder + recipeName + '.js'

	// IE and FF convert &#160; to "&nbsp;", Safari and Opera do not
	, replaceSpace:       "&#160;"
	, replaceTab:         "&#160;&#160;&#160;&#160;"
	, replaceNewLine:     "&#160;<br class=\"close\"/>"

	, selectionStyle:     [ "position:absolute; z-index:3000; overflow:scroll;"
						  , "width:16em;"
						  , "height:9em;"
						  , "border:1px solid gray;"
						  , "padding:15px;"
						  , "background-color:yellow;"
						  ].join( ' ' )

// ------------------------------------------------------------- end of options

	, defaultReplacement: '<span class="$0">$$</span>' // TODO: make this an option again
	, recipes:            {} //repository
	, queue:              {} //registry

	, unique:             function() {
		return (new Date()).valueOf();
	}
};



$.fn.Lchili = function( options ) {
	var book = $.extend( {}, LChiliBook, options || {} );

	function cook( ingredients, recipe, blockName ) {

		function prepareBlock( recipe, blockName ) {
			var steps = [];
			for( var stepName in recipe[ blockName ] ) {
				steps.push( prepareStep( recipe, blockName, stepName ) );
			}
			return steps;
		} // prepareBlock

		function prepareStep( recipe, blockName, stepName ) {
			var step = recipe[ blockName ][ stepName ];
			var exp = ( typeof step._match == "string" ) ? step._match : step._match.source;
			return {
				recipe: recipe
				, blockName: blockName
				, stepName: stepName
				, exp: "(" + exp + ")"
				, length: 1                         // add 1 to account for the newly added parentheses
					+ (exp                          // count number of submatches in here
						.replace( /\\./g, "%" )     // disable any escaped character
						.replace( /\[.*?\]/g, "%" ) // disable any character class
						.match( /\((?!\?)/g )       // match any open parenthesis, not followed by a ?
					|| []                           // make sure it is an empty array if there are no matches
					).length                        // get the number of matches
				, replacement: step._replace ? step._replace : book.defaultReplacement
			};
		} // prepareStep
	
		function knowHow( steps ) {
			var prevLength = 1;
			var exps = [];
			for (var i = 0; i < steps.length; i++) {
				var exp = steps[ i ].exp;
				// adjust backreferences
				exp = exp.replace( /\\\\|\\(\d+)/g, function( m, aNum ) {
					return !aNum ? m : "\\" + ( prevLength + 1 + parseInt( aNum, 10 ) );
				} );
				exps.push( exp );
				prevLength += steps[ i ].length;
			}
			var prolog = '((?:\\s|\\S)*?)';
			var epilog = '((?:\\s|\\S)+)';
			var source = '(?:' + exps.join( "|" ) + ')';
			source = prolog + source + '|' + epilog;
			return new RegExp( source, recipe._case ? "g" : "gi" );
		} // knowHow

		function escapeHTML( str ) {
			return str.replace( /&/g, "&amp;" ).replace( /</g, "&lt;" );
		} // escapeHTML

		function replaceSpaces( str ) {
			return str.replace( / +/g, function( spaces ) {
				return spaces.replace( / /g, replaceSpace );
			} );
		} // replaceSpaces

		function filter( str ) {
			str = escapeHTML( str );
			if( replaceSpace ) {
				str = replaceSpaces( str );
			}
			return str;
		} // filter

		function applyRecipe( subject, recipe ) {
			return cook( subject, recipe );
		} // applyRecipe

		function applyBlock( subject, recipe, blockName ) {
			return cook( subject, recipe, blockName );
		} // applyBlock

		function applyStep( subject, recipe, blockName, stepName ) {
			var replaceSpace       = book.replaceSpace;

			var step = prepareStep( recipe, blockName, stepName );
			var steps = [step];

			var perfect = subject.replace( knowHow( steps ), function() {
				return chef.apply( { steps: steps }, arguments );
			} );
			return perfect;
		} // applyStep

		function applyModule( subject, module, context ) {
			if( ! module ) {
				return filter( subject );
			}

			var sub = module.split( '/' );
			var recipeName = '';
			var blockName  = '';
			var stepName   = '';
			switch( sub.length ) {
				case 1:
					recipeName = sub[0];
					break;
				case 2:
					recipeName = sub[0]; blockName = sub[1];
					break;
				case 3:
					recipeName = sub[0]; blockName = sub[1]; stepName = sub[2];
					break;
				default:
					return filter( subject );
			}

			function getRecipe( recipeName ) {
				var path = getPath( recipeName );
				var recipe = book.recipes[ path ];
				if( ! recipe ) {
					throw {msg:"recipe not available"};
				}
				return recipe;
			}

			try {
				var recipe;
				if ( '' == stepName ) {
					if ( '' == blockName ) {
						if ( '' == recipeName ) {
							//nothing to do
						}
						else { // ( '' != recipeName )
							recipe = getRecipe( recipeName );
							return applyRecipe( subject, recipe );
						}
					}
					else { // ( '' != blockName )
						if( '' == recipeName ) {
							recipe = context.recipe;
						}
						else {
							recipe = getRecipe( recipeName );
						}
						if( ! (blockName in recipe) ) {
							return filter( subject );
						}
						return applyBlock( subject, recipe, blockName );
					}
				}
				else { // ( '' != stepName )
					if( '' == recipeName ) {
						recipe = context.recipe;
					}
					else {
						recipe = getRecipe( recipeName );
					}
					if( '' == blockName ) {
						blockName = context.blockName;
					}
					if( ! (blockName in recipe) ) {
						return filter( subject );
					}
					if( ! (stepName in recipe[blockName]) ) {
						return filter( subject );
					}
					return applyStep( subject, recipe, blockName, stepName );
				}
			}
			catch( e ) {
				if (e.msg && e.msg == "recipe not available") {
					var cue = 'chili_' + book.unique();
					if( book.recipeLoading ) {
						var path = getPath( recipeName );
						if( ! book.queue[ path ] ) {
							/* this is a new recipe to download */
							try {
								book.queue[ path ] = [ {cue: cue, subject: subject, module: module, context: context} ];
								$.getJSON( path, function( recipeLoaded ) {
									book.recipes[ path ] = recipeLoaded;
									var q = book.queue[ path ];
									for( var i = 0, iTop = q.length; i < iTop; i++ ) {
										var replacement = applyModule( q[ i ].subject, q[ i ].module, q[ i ].context );
										if( book.replaceTab ) {
											replacement = replacement.replace( /\t/g, book.replaceTab );
										}
										if( book.replaceNewLine ) {
											replacement = replacement.replace( /\n/g, book.replaceNewLine );
										}
										$( '#' + q[ i ].cue ).replaceWith( replacement );
									}
								} );
							}
							catch( recipeNotAvailable ) {
								alert( "the recipe for '" + recipeName + "' was not found in '" + path + "'" );
							}
						}
						else {
							/* not a new recipe, so just enqueue this element */
							book.queue[ path ].push( {cue: cue, subject: subject, module: module, context: context} );
						}
						return '<span id="' + cue + '">' + filter( subject ) + '</span>';
					}
					return filter( subject );
				}
				else {
					return filter( subject );
				}
			}
		} // applyModule

		function addPrefix( prefix, replacement ) {
			var aux = replacement.replace( /(<span\s+class\s*=\s*(["']))((?:(?!__)\w)+\2\s*>)/ig, "$1" + prefix + "__$3" );
			return aux;
		} // addPrefix

		function chef() {
			if (! arguments[ 0 ]) {
				return '';
			}
			var steps = this.steps;
			var i = 0;  // iterate steps
			var j = 2;	// iterate chef's arguments
			var prolog = arguments[ 1 ];
			var epilog = arguments[ arguments.length - 3 ];
			if (! epilog) {
				var step;
				while( step = steps[ i++ ] ) {
					var aux = arguments; // this unmasks chef's arguments inside the next function
					if( aux[ j ] ) {
						var replacement = '';
						if( $.isFunction( step.replacement ) ) {
							var matches = []; //Array.slice.call( aux, j, step.length );
							for (var k = 0, kTop = step.length; k < kTop; k++) {
								matches.push( aux[ j + k ] );
							}
							matches.push( aux[ aux.length - 2 ] );
							matches.push( aux[ aux.length - 1 ] );
							replacement = step.replacement
								.apply( { 
									x: function() { 
										var subject = arguments[0];
										var module  = arguments[1];
										var context = { 
											  recipe:    step.recipe
											, blockName: step.blockName 
										};
										return applyModule( subject, module, context );
									} 
								}, matches );
						}
						else { //we expect step.replacement to be a string
							replacement = step.replacement
								.replace( /(\\\$)|(?:\$\$)|(?:\$(\d+))/g, function( m, escaped, K ) {
									if( escaped ) {       /* \$ */ 
										return "$";
									}
									else if( !K ) {       /* $$ */ 
										return filter( aux[ j ] );
									}
									else if( K == "0" ) { /* $0 */ 
										return step.stepName;
									}
									else {                /* $K */
										return filter( aux[ j + parseInt( K, 10 ) ] );
									}
								} );
						}
						replacement = addPrefix( step.recipe._name, replacement );
						return filter( prolog ) + replacement;
					} 
					else {
						j+= step.length;
					}
				}
			}
			else {
				return filter( epilog );
			}
		} // chef

		if( ! blockName ) {
			blockName = '_main';
			checkSpices( recipe );
		}
		if( ! (blockName in recipe) ) {
			return filter( ingredients );
		}
		var replaceSpace = book.replaceSpace;
		var steps = prepareBlock( recipe, blockName );
		var kh = knowHow( steps );
		var perfect = ingredients.replace( kh, function() {
			return chef.apply( { steps: steps }, arguments );
		} );
		return perfect;

	} // cook

	function loadStylesheetInline( sourceCode ) { 
		if( document.createElement ) { 
			var e = document.createElement( "style" ); 
			e.type = "text/css"; 
			if( e.styleSheet ) { // IE 
				e.styleSheet.cssText = sourceCode; 
			}  
			else { 
				var t = document.createTextNode( sourceCode ); 
				e.appendChild( t ); 
			} 
			document.getElementsByTagName( "head" )[0].appendChild( e ); 
		} 
	} // loadStylesheetInline
			
	function checkSpices( recipe ) {
		var name = recipe._name;
		if( ! book.queue[ name ] ) {

			var content = ['/* Chili -- ' + name + ' */'];
			for (var blockName in recipe) {
				if( blockName.search( /^_(?!main\b)/ ) < 0 ) {
					for (var stepName in recipe[ blockName ]) {
						var step = recipe[ blockName ][ stepName ];
						if( '_style' in step ) {
							if( step[ '_style' ].constructor == String ) {
								content.push( '.' + name + '__' + stepName + ' { ' + step[ '_style' ] + ' }' );
							}
							else {
								for (var className in step[ '_style' ]) {
									content.push( '.' + name + '__' + className + ' { ' + step[ '_style' ][ className ] + ' }' );
								}
							}
						}
					}
				}
			}
			content = content.join('\n');

			loadStylesheetInline( content );

			book.queue[ name ] = true;
		}
	} // checkSpices

	function askDish( el ) {
		var recipeName = book.codeLanguage( el );
		if( '' != recipeName ) {
			var path = getPath( recipeName );
			if( book.recipeLoading ) {
				/* dynamic setups come here */
				if( ! book.queue[ path ] ) {
					/* this is a new recipe to download */
					try {
						book.queue[ path ] = [ el ];
						$.getJSON( path, function( recipeLoaded ) {
							book.recipes[ path ] = recipeLoaded;
							var q = book.queue[ path ];
							for( var i = 0, iTop = q.length; i < iTop; i++ ) {
								makeDish( q[ i ], path );
							}
						} );
					}
					catch( recipeNotAvailable ) {
						alert( "the recipe for '" + recipeName + "' was not found in '" + path + "'" );
					}
				}
				else {
					/* not a new recipe, so just enqueue this element */
					book.queue[ path ].push( el );
				}
				/* a recipe could have been already downloaded */
				makeDish( el, path ); 
			}
			else {
				/* static setups come here */
				makeDish( el, path );
			}
		}
	} // askDish

	function makeDish( el, recipePath ) {
		var recipe = book.recipes[ recipePath ];
		if( ! recipe ) {
			return;
		}
		var $el = $( el );
		var ingredients = $el.text();
		if( ! ingredients ) {
			return;
		}

		//fix for msie: \r (13) is used instead of \n (10)
		//fix for opera: \r\n is used instead of \n
		ingredients = ingredients.replace(/\r\n?/g, "\n");

		//reverse fix for safari: msie, mozilla and opera render the initial \n
		if( $el.parent().is('pre') ) {
			if( ! $.browser.safari ) {
				ingredients = ingredients.replace(/^\n/g, "");
			}
		}

		var dish = cook( ingredients, recipe ); // all happens here
	
		if( book.replaceTab ) {
			dish = dish.replace( /\t/g, book.replaceTab );
		}
		if( book.replaceNewLine ) {
			dish = dish.replace( /\n/g, book.replaceNewLine );
		}

		el.innerHTML = dish; //much faster than $el.html( dish );
		//tried also the function replaceHtml from http://blog.stevenlevithan.com/archives/faster-than-innerhtml
		//but it was not faster nor without sideffects (it was not possible to count spans into el)

		//opera and safari select PRE text correctly 
		if( $.browser.msie || $.browser.mozilla ) {
			enableSelectionHelper( el );
		}

		var $that = $el.parent();
		var classes = $that.attr( 'class' );
		var ln = /ln-(\d+)-([\w][\w\-]*)|ln-(\d+)|ln-/.exec( classes );
		if( ln ) {
			addLineNumbers( el );
			var start = 0;
			if( ln[1] ) {
				start = parseInt( ln[1], 10 );
				var $pieces = $( '.ln-' + ln[1] + '-' + ln[2] );
				var pos = $pieces.index( $that[0] );
				$pieces.slice( 0, pos ).each( function() {
					start += $( this ).find( 'li' ).length;
				} );
			}
			else if( ln[3] ) {
				start = parseInt( ln[3], 10 );
			}
			else {
				start = 1;
			}
			$el.find( 'ol' )[0].start = start;
			$('body').width( $('body').width() - 1 ).width( $('body').width() + 1 );
		}
		else if( book.lineNumbers ) {
			addLineNumbers( el );
		}

	} // makeDish

	function enableSelectionHelper( el ) {
		var element = null;
		$( el )
		.parents()
		.filter( "pre" )
		.bind( "mousedown", function() {
			element = this;
			if( $.browser.msie ) {
				document.selection.empty();
			}
			else {
				window.getSelection().removeAllRanges();
			}
		} )
		.bind( "mouseup", function( event ) {
			if( element && (element == this) ) {
				element = null;
				var selected = '';
				if( $.browser.msie ) {
					selected = document.selection.createRange().htmlText;
					if( '' == selected ) { 
						return;
					}
					selected = preserveNewLines( selected );
					var container_tag = '<textarea style="STYLE">';
				}
				else {
					selected = window.getSelection().toString(); //opera doesn't select new lines
					if( '' == selected ) {
						return;
					}
					selected = selected
						.replace( /\r/g, '' )
						.replace( /^# ?/g, '' )
						.replace( /\n# ?/g, '\n' )
					;
					var container_tag = '<pre style="STYLE">';
				}
				var $container = $( container_tag.replace( /\bSTYLE\b/, LChiliBook.selectionStyle ) )
					.appendTo( 'body' )
					.text( selected )
					.attr( 'id', 'chili_selection' )
					.click( function() { $(this).remove(); } )
				;
				var top  = event.pageY - Math.round( $container.height() / 2 ) + "px";
				var left = event.pageX - Math.round( $container.width() / 2 ) + "px";
				$container.css( { top: top, left: left } );
				if( $.browser.msie ) {
//					window.clipboardData.setData( 'Text', selected ); //I couldn't find anything similar for Mozilla
					$container[0].focus();
					$container[0].select();
				}
				else {
					var s = window.getSelection();
					s.removeAllRanges();
					var r = document.createRange();
					r.selectNodeContents( $container[0] );
					s.addRange( r );
				}
			}
		} )
		;
	} // enableSelectionHelper

	function getPath( recipeName ) {
		return book.recipeFolder + recipeName + ".js";
	} // getPath

	function getSelectedText() {
		var text = '';
		if( $.browser.msie ) {
			text = document.selection.createRange().htmlText;
		}
		else {
			text = window.getSelection().toString();
		}
		return text;
	} // getSelectedText

	function preserveNewLines( html ) {
		do { 
			var newline_flag = LChiliBook.unique();
		}
		while( html.indexOf( newline_flag ) > -1 );
		var text = '';
		if (/<br/i.test(html) || /<li/i.test(html)) {
			if (/<br/i.test(html)) {
				html = html.replace( /\<br[^>]*?\>/ig, newline_flag );
			}
			else if (/<li/i.test(html)) {
				html = html.replace( /<ol[^>]*?>|<\/ol>|<li[^>]*?>/ig, '' ).replace( /<\/li>/ig, newline_flag );
			}
			var el = $( '<pre>' ).appendTo( 'body' ).hide()[0];
			el.innerHTML = html;
			text = $( el ).text().replace( new RegExp( newline_flag, "g" ), '\r\n' );
			$( el ).remove();
		}
		return text;
	} // preserveNewLines

	function addLineNumbers( el ) {

		function makeListItem1( not_last_line, not_last, last, open ) {
			var close = open ? '</span>' : '';
			var aux = '';
			if( not_last_line ) {
				aux = '<li>' + open + not_last + close + '</li>';
			}
			else if( last ) {
				aux = '<li>' + open + last + close + '</li>';
			}
			return aux;
		} // makeListItem1

		function makeListItem2( not_last_line, not_last, last, prev_li ) {
			var aux = '';
			if( prev_li ) {
				aux = prev_li;
			}
			else {
				aux = makeListItem1( not_last_line, not_last, last, '' )
			}
			return aux;
		} // makeListItem2

		var html = $( el ).html();
		var br = /<br>/.test(html) ? '<br>' : '<BR>';
		var empty_line = '<li>' + book.replaceSpace + '</li>';
		var list_items = html
			//extract newlines at the beginning of a span
			.replace( /(<span [^>]+>)((?:(?:&nbsp;|\xA0)<br>)+)(.*?)(<\/span>)/ig, '$2$1$3$4' ) // I don't know why <span .*?> does not work here
			//transform newlines inside of a span
			.replace( /(.*?)(<span .*?>)(.*?)(?:<\/span>(?:&nbsp;|\xA0)<br>|<\/span>)/ig,       // but here it does
				function( all, before, open, content ) {
					if (/<br>/i.test(content)) {
						var pieces = before.split( br );
						var lastPiece = pieces.pop();
						before = pieces.join( br );
						var aux = (before ? before + br : '') //+ replace1( lastPiece + content, open );
							+ (lastPiece + content).replace( /((.*?)(?:&nbsp;|\xA0)<br>)|(.*)/ig, 
							function( tmp, not_last_line, not_last, last ) {
								var aux2 = makeListItem1( not_last_line, not_last, last, open );
								return aux2;
							} 
						);
						return aux;
					}
					else {
						return all;
					}
				} 
			)
			//transform newlines outside of a span
			.replace( /(<li>.*?<\/li>)|((.*?)(?:&nbsp;|\xA0)<br>)|(.+)/ig, 
				function( tmp, prev_li, not_last_line, not_last, last ) {
					var aux2 = makeListItem2( not_last_line, not_last, last, prev_li );
					return aux2;
				} 
			)
			//fix empty lines for Opera
			.replace( /<li><\/li>/ig, empty_line )
		;

		el.innerHTML = '<ol>' + list_items + '</ol>';
	} // addLineNumbers

	function revealChars( tmp ) {
		return $
			.map( tmp.split(''), 
				function(n, i) { 
					return ' ' + n + ' ' + n.charCodeAt( 0 ) + ' ';
				} )
			.join(' ');
	} // revealChars

//-----------------------------------------------------------------------------
// the coloring starts here
	this
	.each( function() {
		var $this = $( this );
		$this.trigger( 'chili.before_coloring' );
		askDish( this );
		$this.trigger( 'chili.after_coloring' );
	} );

	return this;
//-----------------------------------------------------------------------------
};



//main
$( function() {

	if( LChiliBook.automatic ) {
		$( LChiliBook.automaticSelector ).Lchili();
	}

} );

} ) ( jQuery );



LChiliBook.queue['sql.js']= new Array;
LChiliBook.recipes['sql.js'] = {
	  _name: "sql"
	, _case: false
	, _main: {
		  mlcom: {
			  _match: /\/\*[^*]*\*+([^\/][^*]*\*+)*\// 
			, _style: "color: gray;"
		}
		, com: {
			  _match: /(?:--\s+.*)|(?:[^\\]\#.*)/ 
			, _style: "color: green;"
		}
		, string: {
			  _match: /([\"\'])(?:(?:[^\1\\\r\n]*?(?:\1\1|\\.))*[^\1\\\r\n]*?)\1/ 
			, _style: "color: purple;"
		}
		, quid: {
			  _match: /(`)(?:(?:[^\1\\\r\n]*?(?:\1\1|\\.))*[^\1\\\r\n]*?)\1/ 
			, _style: "color: fuchsia;"
		}
		, value: {
			  _match: /\b(?:NULL|TRUE|FALSE)\b/ 
			, _style: "color: gray; font-weight: bold;"
		}
		, number: {
			  _match: /\b[+-]?(\d*\.?\d+|\d+\.?\d*)([eE][+-]?\d+)?\b/ 
			, _style: "color: red;"
		}
		, hexnum: {
			  _match: /\b0[xX][\dA-Fa-f]+\b|\b[xX]([\'\"])[\dA-Fa-f]+\1/ 
			, _style: "color: red; font-weight: bold;"
		}
		, variable: {
			  _match: /@([$.\w]+|([`\"\'])(?:(?:[^\2\\\r\n]*?(?:\2\2|\\.))*[^\2\\\r\n]*?)\2)/
			, _replace: '<span class="keyword">@</span><span class="variable">$1</span>'
			, _style: "color: #4040c2;"
		}
		, keyword: {
			  _match: /\b(?:A(?:CTION|DD|FTER|G(?:AINST|GREGATE)|L(?:GORITHM|L|TER)|N(?:ALYZE|D|Y)|S(?:C(?:II|)|ENSITIVE|)|UTO_INCREMENT|VG(?:_ROW_LENGTH|))|B(?:ACKUP|DB|E(?:FORE|GIN|RKELEYDB|TWEEN)|I(?:GINT|N(?:ARY|LOG)|T)|LOB|O(?:OL(?:EAN|)|TH)|TREE|Y(?:TE|))|C(?:A(?:CHE|LL|S(?:CADE(?:D|)|E))|H(?:A(?:IN|NGE(?:D|)|R(?:ACTER|SET|))|ECK(?:SUM|))|IPHER|L(?:IENT|OSE)|O(?:DE|L(?:LAT(?:E|ION)|UMN(?:S|))|M(?:M(?:ENT|IT(?:TED|))|P(?:ACT|RESSED))|N(?:CURRENT|DITION|NECTION|S(?:ISTENT|TRAINT)|T(?:AINS|INUE)|VERT))|R(?:EATE|OSS)|U(?:BE|R(?:RENT_(?:DATE|TIME(?:STAMP|)|USER)|SOR)))|D(?:A(?:T(?:A(?:BASE(?:S|)|)|E(?:TIME|))|Y(?:_(?:HOUR|MI(?:CROSECOND|NUTE)|SECOND)|))|E(?:ALLOCATE|C(?:IMAL|LARE|)|F(?:AULT|INER)|L(?:AY(?:ED|_KEY_WRITE)|ETE)|S(?:C(?:RIBE|)|_KEY_FILE)|TERMINISTIC)|I(?:RECTORY|S(?:ABLE|CARD|TINCT(?:ROW|))|V)|O(?:UBLE|)|ROP|U(?:AL|MPFILE|PLICATE)|YNAMIC)|E(?:ACH|LSE(?:IF|)|N(?:ABLE|CLOSED|D|GINE(?:S|)|UM)|RRORS|SCAPE(?:D|)|VENTS|X(?:ECUTE|I(?:STS|T)|P(?:ANSION|LAIN)|TENDED))|F(?:A(?:LSE|ST)|ETCH|I(?:ELDS|LE|RST|XED)|L(?:OAT(?:4|8|)|USH)|O(?:R(?:CE|EIGN|)|UND)|R(?:AC_SECOND|OM)|U(?:LL(?:TEXT|)|NCTION))|G(?:E(?:OMETRY(?:COLLECTION|)|T_FORMAT)|LOBAL|R(?:ANT(?:S|)|OUP))|H(?:A(?:NDLER|SH|VING)|ELP|IGH_PRIORITY|O(?:STS|UR(?:_(?:MI(?:CROSECOND|NUTE)|SECOND)|)))|I(?:DENTIFIED|F|GNORE|MPORT|N(?:DEX(?:ES|)|FILE|N(?:ER|O(?:BASE|DB))|OUT|SE(?:NSITIVE|RT(?:_METHOD|))|T(?:1|2|3|4|8|E(?:GER|RVAL)|O|)|VOKER|)|O_THREAD|S(?:OLATION|SUER|)|TERATE)|JOIN|K(?:EY(?:S|)|ILL)|L(?:A(?:NGUAGE|ST)|E(?:A(?:DING|VE(?:S|))|FT|VEL)|I(?:KE|MIT|NES(?:TRING|))|O(?:AD|C(?:AL(?:TIME(?:STAMP|)|)|K(?:S|))|GS|NG(?:BLOB|TEXT|)|OP|W_PRIORITY))|M(?:A(?:STER(?:_(?:CONNECT_RETRY|HOST|LOG_(?:FILE|POS)|P(?:ASSWORD|ORT)|S(?:ERVER_ID|SL(?:_(?:C(?:A(?:PATH|)|ERT|IPHER)|KEY)|))|USER)|)|TCH|X_(?:CONNECTIONS_PER_HOUR|QUERIES_PER_HOUR|ROWS|U(?:PDATES_PER_HOUR|SER_CONNECTIONS)))|E(?:DIUM(?:BLOB|INT|TEXT|)|RGE)|I(?:CROSECOND|DDLEINT|GRATE|N(?:UTE(?:_(?:MICROSECOND|SECOND)|)|_ROWS))|O(?:D(?:E|IF(?:IES|Y)|)|NTH)|U(?:LTI(?:LINESTRING|PO(?:INT|LYGON))|TEX))|N(?:A(?:ME(?:S|)|T(?:IONAL|URAL))|CHAR|DB(?:CLUSTER|)|E(?:W|XT)|O(?:NE|T|_WRITE_TO_BINLOG|)|U(?:LL|MERIC)|VARCHAR)|O(?:FFSET|LD_PASSWORD|N(?:E(?:_SHOT|)|)|P(?:EN|TI(?:MIZE|ON(?:ALLY|)))|R(?:DER|)|UT(?:ER|FILE|))|P(?:A(?:CK_KEYS|RTIAL|SSWORD)|HASE|O(?:INT|LYGON)|R(?:E(?:CISION|PARE|V)|I(?:MARY|VILEGES)|OCE(?:DURE|SS(?:LIST|)))|URGE)|QU(?:ARTER|ERY|ICK)|R(?:AID(?:0|_(?:CHUNKS(?:IZE|)|TYPE))|E(?:A(?:D(?:S|)|L)|COVER|DUNDANT|FERENCES|GEXP|L(?:AY_(?:LOG_(?:FILE|POS)|THREAD)|EASE|OAD)|NAME|P(?:AIR|EAT(?:ABLE|)|L(?:ACE|ICATION))|QUIRE|S(?:ET|T(?:ORE|RICT)|UME)|TURN(?:S|)|VOKE)|IGHT|LIKE|O(?:LL(?:BACK|UP)|UTINE|W(?:S|_FORMAT|))|TREE)|S(?:AVEPOINT|CHEMA(?:S|)|E(?:C(?:OND(?:_MICROSECOND|)|URITY)|LECT|NSITIVE|PARATOR|RIAL(?:IZABLE|)|SSION|T)|H(?:ARE|OW|UTDOWN)|I(?:GNED|MPLE)|LAVE|MALLINT|NAPSHOT|O(?:ME|NAME|UNDS)|P(?:ATIAL|ECIFIC)|QL(?:EXCEPTION|STATE|WARNING|_(?:B(?:IG_RESULT|UFFER_RESULT)|CA(?:CHE|LC_FOUND_ROWS)|NO_CACHE|SMALL_RESULT|T(?:HREAD|SI_(?:DAY|FRAC_SECOND|HOUR|M(?:INUTE|ONTH)|QUARTER|SECOND|WEEK|YEAR)))|)|SL|T(?:A(?:RT(?:ING|)|TUS)|O(?:P|RAGE)|R(?:AIGHT_JOIN|I(?:NG|PED)))|U(?:BJECT|PER|SPEND))|T(?:ABLE(?:S(?:PACE|)|)|E(?:MP(?:ORARY|TABLE)|RMINATED|XT)|HEN|I(?:ME(?:STAMP(?:ADD|DIFF|)|)|NY(?:BLOB|INT|TEXT))|O|R(?:A(?:ILING|NSACTION)|IGGER(?:S|)|U(?:E|NCATE))|YPE(?:S|))|U(?:N(?:COMMITTED|D(?:EFINED|O)|I(?:CODE|ON|QUE)|KNOWN|LOCK|SIGNED|TIL)|P(?:DATE|GRADE)|S(?:AGE|E(?:R(?:_RESOURCES|)|_FRM|)|ING)|TC_(?:DATE|TIME(?:STAMP|)))|V(?:A(?:LUE(?:S|)|R(?:BINARY|CHAR(?:ACTER|)|IABLES|YING))|IEW)|W(?:ARNINGS|EEK|H(?:E(?:N|RE)|ILE)|ITH|ORK|RITE)|X(?:509|A|OR)|YEAR(?:_MONTH|)|ZEROFILL)\b/
			, _style: "color: navy; font-weight: bold;"
		}
		, 'function': {
			  _match: /\b(?:A(?:BS|COS|DD(?:DATE|TIME)|ES_(?:DECRYPT|ENCRYPT)|REA|S(?:BINARY|IN|TEXT|WK(?:B|T))|TAN(?:2|))|B(?:ENCHMARK|I(?:N|T_(?:AND|COUNT|LENGTH|OR|XOR)))|C(?:AST|E(?:IL(?:ING|)|NTROID)|HAR(?:ACTER_LENGTH|_LENGTH)|O(?:ALESCE|ERCIBILITY|MPRESS|N(?:CAT(?:_WS|)|NECTION_ID|V(?:ERT_TZ|))|S|T|UNT)|R(?:C32|OSSES)|UR(?:DATE|TIME))|D(?:A(?:TE(?:DIFF|_(?:ADD|FORMAT|SUB))|Y(?:NAME|OF(?:MONTH|WEEK|YEAR)))|E(?:CODE|GREES|S_(?:DECRYPT|ENCRYPT))|I(?:MENSION|SJOINT))|E(?:LT|N(?:C(?:ODE|RYPT)|DPOINT|VELOPE)|QUALS|X(?:P(?:ORT_SET|)|T(?:ERIORRING|RACT)))|F(?:I(?:ELD|ND_IN_SET)|LOOR|O(?:RMAT|UND_ROWS)|ROM_(?:DAYS|UNIXTIME))|G(?:E(?:OM(?:COLLFROM(?:TEXT|WKB)|ETRY(?:COLLECTIONFROM(?:TEXT|WKB)|FROM(?:TEXT|WKB)|N|TYPE)|FROM(?:TEXT|WKB))|T_LOCK)|LENGTH|R(?:EATEST|OUP_(?:CONCAT|UNIQUE_USERS)))|HEX|I(?:FNULL|N(?:ET_(?:ATON|NTOA)|STR|TER(?:IORRINGN|SECTS))|S(?:CLOSED|EMPTY|NULL|SIMPLE|_(?:FREE_LOCK|USED_LOCK)))|L(?:AST_(?:DAY|INSERT_ID)|CASE|E(?:AST|NGTH)|INE(?:FROM(?:TEXT|WKB)|STRINGFROM(?:TEXT|WKB))|N|O(?:AD_FILE|CATE|G(?:10|2|)|WER)|PAD|TRIM)|M(?:A(?:KE(?:DATE|TIME|_SET)|STER_POS_WAIT|X)|BR(?:CONTAINS|DISJOINT|EQUAL|INTERSECTS|OVERLAPS|TOUCHES|WITHIN)|D5|I(?:D|N)|LINEFROM(?:TEXT|WKB)|ONTHNAME|PO(?:INTFROM(?:TEXT|WKB)|LYFROM(?:TEXT|WKB))|ULTI(?:LINESTRINGFROM(?:TEXT|WKB)|PO(?:INTFROM(?:TEXT|WKB)|LYGONFROM(?:TEXT|WKB))))|N(?:AME_CONST|OW|U(?:LLIF|M(?:GEOMETRIES|INTERIORRINGS|POINTS)))|O(?:CT(?:ET_LENGTH|)|RD|VERLAPS)|P(?:ERIOD_(?:ADD|DIFF)|I|O(?:INT(?:FROM(?:TEXT|WKB)|N)|LY(?:FROM(?:TEXT|WKB)|GONFROM(?:TEXT|WKB))|SITION|W(?:ER|)))|QUOTE|R(?:A(?:DIANS|ND)|E(?:LEASE_LOCK|VERSE)|O(?:UND|W_COUNT)|PAD|TRIM)|S(?:E(?:C_TO_TIME|SSION_USER)|HA(?:1|)|I(?:GN|N)|LEEP|OUNDEX|PACE|QRT|RID|T(?:ARTPOINT|D(?:DEV(?:_(?:POP|SAMP)|)|)|R(?:CMP|_TO_DATE))|U(?:B(?:DATE|STR(?:ING(?:_INDEX|)|)|TIME)|M)|YS(?:DATE|TEM_USER))|T(?:AN|IME(?:DIFF|_(?:FORMAT|TO_SEC))|O(?:UCHES|_DAYS)|RIM)|U(?:CASE|N(?:COMPRESS(?:ED_LENGTH|)|HEX|I(?:QUE_USERS|X_TIMESTAMP))|PPER|UID)|V(?:AR(?:IANCE|_(?:POP|SAMP))|ERSION)|W(?:EEK(?:DAY|OFYEAR)|ITHIN)|X|Y(?:EARWEEK|))(?=\()/ 
			, _style: "color: #e17100;"
		}
		, id: {
			  _match: /[$\w]+/ 
			, _style: "color: maroon;"
		}
	}
};

/* Chili Recipe for Lasso by Jason Huck/Core Five Creative */
LChiliBook.queue['lasso.js']= new Array;
LChiliBook.recipes['lasso.js'] = {
	_name: 'lasso',
	_main: {
		  mlcom   : { _match: /\/\*[^*]*\*+([^\/][^*]*\*+)*\// , _style: "color: #999;" }
		, delim   : { _match: /(?:\<\?[Ll][Aa][Ss][Ss][Oo][Ss][Cc][Rr][Ii][Pp][Tt]|\[|\]|\?\>)/ , _style: "color: #666;" }
		, com     : { _match: /(?:\/\/.*)/ , _style: "color: #999;"}
		, string1 : { _match: /\'[^\'\\]*(?:\\.[^\'\\]*)*\'/, _style: "color: #00F;" }
		, string2 : { _match: /\"[^\"\\]*(?:\\.[^\"\\]*)*\"/, _style: "color: #00F;"  }
		, type    : { _match: /\b(?:[Ss][Ee][Ll][Ff]|[Nn][Uu][Ll][Ll]|[Tt][Rr][Uu][Ee]|[Ff][Aa][Ll][Ss][Ee]|[Dd][Ee][Cc][Ii][Mm][Aa][Ll]|[Ii][Nn][Tt][Ee][Gg][Ee][Rr]|[Ss][Tt][Rr][Ii][Nn][Gg]|[Dd][Aa][Tt][Ee]|[Bb][Oo][Oo][Ll][Ee][Aa][Nn]|[Xx][Mm][Ll]|[Aa][Rr][Rr][Aa][Yy]|[Dd][Uu][Rr][Aa][Tt][Ii][Oo][Nn]|[Mm][Aa][Pp]|[Pp][Aa][Ii][Rr]|[Tt][Aa][Gg])\b/, _style: "font-weight:bold;color: #06C;"  }
		, number  : { _match: /\b[+-]?(\d*\.?\d+|\d+\.?\d*)([eE][+-]?\d+)?\b/, _style: " color: #F00;" }
		, param   : { _match: /-\w+/, _style: "color: #36C; "  }
		, variable: { _match: /\$\w+/, _style: "color: #909; font-weight:bold;"  }
		, local   : { _match: /#\w+/, _style: "color: #909; font-weight:bold;"  }
		, member  : { _match: /(?:->|&)\w+/, _style: "color: #000;"  }
		, ops     : { _match: /[\+=,;\?\|@>\!\\\/\(\)\{\}:%\>\<&]/, _style: "color: #000;"  }
	}
};

LChiliBook.queue['css.js']= new Array;
LChiliBook.recipes['css.js'] = {
	  _name: 'css'
	, _case: true
	, _main: {
		  comment: { 
			  _match: /\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\// 
			, _style: "color: olive;"
		}
		, directive: {
			  _match: /@\w+/
			, _style: "color: fuchsia;"
		}
		, url: {
			  _match: /\b(url\s*\()([^)]+)(\))/
			, _replace: "<span class='url'>$1</span>$2<span class='url'>$3</span>"
			, _style: "color: fuchsia;"
		}
		, block:   {
			  _match: /\{([\w\W]*?)\}/
			, _replace: function( all, pairs ) {
				return '{' + this.x( pairs, '/definition' ) + '}';
			}
		}
		, 'class': {
			  _match: /\.\w+/
			, _style: "color: #CC0066; font-weight: bold;"
		}
		, id:      {
			  _match: /#\w+/
			, _style: "color: IndianRed; font-weight: bold;"
		}
		, pseudo:  {
			  _match: /:\w+/
			, _style: "color: #CC9900;"
		}
		, element: {
			  _match: /\w+/
			, _style: "color: Purple; font-weight: bold;"
		}
	}
	, definition: {
		  comment: { 
			  _match: /\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\//
		}
		, property: {
			  _match: /\b(?:zoom|z-index|writing-mode|word-wrap|word-spacing|word-break|width|widows|white-space|volume|voice-family|visibility|vertical-align|unicode-bidi|top|text-underline-position|text-transform|text-shadow|text-overflow|text-kashida-space|text-justify|text-indent|text-decoration|text-autospace|text-align-last|text-align|table-layout|stress|speech-rate|speak-punctuation|speak-numeral|speak-header|speak|size|scrollbar-track-color|scrollbar-shadow-color|scrollbar-highlight-color|scrollbar-face-color|scrollbar-dark-shadow-color|scrollbar-base-color|scrollbar-arrow-color|scrollbar-3d-light-color|ruby-position|ruby-overhang|ruby-align|right|richness|quotes|position|play-during|pitch-range|pitch|pause-before|pause-after|pause|page-break-inside|page-break-before|page-break-after|page|padding-top|padding-right|padding-left|padding-bottom|padding|overflow-Y|overflow-X|overflow|outline-width|outline-style|outline-color|outline|orphans|min-width|min-height|max-width|max-height|marks|marker-offset|margin-top|margin-right|margin-left|margin-bottom|margin|list-style-type|list-style-position|list-style-image|list-style|line-height|line-break|letter-spacing|left|layout-grid-type|layout-grid-mode|layout-grid-line|layout-grid-char-spacing|layout-grid-char|layout-grid|layout-flow|layer-background-image|layer-background-color|include-source|ime-mode|height|font-weight|font-variant|font-style|font-stretch|font-size-adjust|font-size|font-family|font|float|filter|empty-cells|elevation|display|direction|cursor|cue-before|cue-after|cue|counter-reset|counter-increment|content|color|clip|clear|caption-side|bottom|border-width|border-top-width|border-top-style|border-top-color|border-top|border-style|border-spacing|border-right-width|border-right-style|border-right-color|border-right|border-left-width|border-left-style|border-left-color|border-left|border-color|border-collapse|border-bottom-width|border-bottom-style|border-bottom-color|border-bottom|border|behavior|background-repeat|background-position-y|background-position-x|background-position|background-image|background-color|background-attachment|background|azimuth|accelerator)\s*:/
			, _style: "color: #330066;"
		}
		, special: {
			  _match: /\b(?:-use-link-source|-set-link-source|-replace|-moz-user-select|-moz-user-modify|-moz-user-input|-moz-user-focus|-moz-outline-width|-moz-outline-style|-moz-outline-color|-moz-outline|-moz-opacity|-moz-border-top-colors|-moz-border-right-colors|-moz-border-radius-topright|-moz-border-radius-topleft|-moz-border-radius-bottomright|-moz-border-radius-bottomleft|-moz-border-radius|-moz-border-left-colors|-moz-border-bottom-colors|-moz-binding)\s*:/
			, _style: "color: #330066; text-decoration: underline;"
		}
		, url: {
			  _match: /\b(url\s*\()([^)]+)(\))/
			, _replace: "<span class='url'>$1</span>$2<span class='url'>$3</span>"
		}
		, value: {
			  _match: /\b(?:xx-small|xx-large|x-soft|x-small|x-slow|x-low|x-loud|x-large|x-high|x-fast|wider|wait|w-resize|visible|url|uppercase|upper-roman|upper-latin|upper-alpha|underline|ultra-expanded|ultra-condensed|tv|tty|transparent|top|thin|thick|text-top|text-bottom|table-row-group|table-row|table-header-group|table-footer-group|table-column-group|table-column|table-cell|table-caption|sw-resize|super|sub|status-bar|static|square|spell-out|speech|solid|soft|smaller|small-caption|small-caps|small|slower|slow|silent|show|separate|semi-expanded|semi-condensed|se-resize|scroll|screen|s-resize|run-in|rtl|rightwards|right-side|right|ridge|rgb|repeat-y|repeat-x|repeat|relative|projection|print|pre|portrait|pointer|overline|outside|outset|open-quote|once|oblique|nw-resize|nowrap|normal|none|no-repeat|no-open-quote|no-close-quote|ne-resize|narrower|n-resize|move|mix|middle|message-box|medium|marker|ltr|lowercase|lower-roman|lower-latin|lower-greek|lower-alpha|lower|low|loud|local|list-item|line-through|lighter|level|leftwards|left-side|left|larger|large|landscape|justify|italic|invert|inside|inset|inline-table|inline|icon|higher|high|hide|hidden|help|hebrew|handheld|groove|format|fixed|faster|fast|far-right|far-left|fantasy|extra-expanded|extra-condensed|expanded|embossed|embed|e-resize|double|dotted|disc|digits|default|decimal-leading-zero|decimal|dashed|cursive|crosshair|cross|crop|counters|counter|continuous|condensed|compact|collapse|code|close-quote|circle|center-right|center-left|center|caption|capitalize|braille|bottom|both|bolder|bold|block|blink|bidi-override|below|behind|baseline|avoid|auto|aural|attr|armenian|always|all|absolute|above)\b/
			, _style: "color: #3366FF;"
		}
		, string: { 
			  _match: /(?:\'[^\'\\\n]*(?:\\.[^\'\\\n]*)*\')|(?:\"[^\"\\\n]*(?:\\.[^\"\\\n]*)*\")/ 
			, _style: "color: teal;"
		}
		, number: { 
			  _match: /(?:\b[+-]?(?:\d*\.?\d+|\d+\.?\d*))(?:%|(?:(?:px|pt|em|)\b))/ 
			, _style: "color: red;"
		}
		, color : { 
			  _match: /(?:\#[a-fA-F0-9]{3,6})|\b(?:yellow|white|teal|silver|red|purple|olive|navy|maroon|lime|green|gray|fuchsia|blue|black|aqua|YellowGreen|Yellow|WhiteSmoke|White|Wheat|Violet|Turquoise|Tomato|Thistle|Teal|Tan|SteelBlue|SpringGreen|Snow|SlateGrey|SlateGray|SlateBlue|SkyBlue|Silver|Sienna|SeaShell|SeaGreen|SandyBrown|Salmon|SaddleBrown|RoyalBlue|RosyBrown|Red|Purple|PowderBlue|Plum|Pink|Peru|PeachPuff|PapayaWhip|PaleVioletRed|PaleTurquoise|PaleGreen|PaleGoldenRod|Orchid|OrangeRed|Orange|OliveDrab|Olive|OldLace|Navy|NavajoWhite|Moccasin|MistyRose|MintCream|MidnightBlue|MediumVioletRed|MediumTurquoise|MediumSpringGreen|MediumSlateBlue|MediumSeaGreen|MediumPurple|MediumOrchid|MediumBlue|MediumAquaMarine|Maroon|Magenta|Linen|LimeGreen|Lime|LightYellow|LightSteelBlue|LightSlateGrey|LightSlateGray|LightSkyBlue|LightSeaGreen|LightSalmon|LightPink|LightGrey|LightGreen|LightGray|LightGoldenRodYellow|LightCyan|LightCoral|LightBlue|LemonChiffon|LawnGreen|LavenderBlush|Lavender|Khaki|Ivory|Indigo|IndianRed|HotPink|HoneyDew|Grey|GreenYellow|Green|Gray|GoldenRod|Gold|GhostWhite|Gainsboro|Fuchsia|ForestGreen|FloralWhite|FireBrick|DodgerBlue|DimGrey|DimGray|DeepSkyBlue|DeepPink|Darkorange|DarkViolet|DarkTurquoise|DarkSlateGrey|DarkSlateGray|DarkSlateBlue|DarkSeaGreen|DarkSalmon|DarkRed|DarkOrchid|DarkOliveGreen|DarkMagenta|DarkKhaki|DarkGrey|DarkGreen|DarkGray|DarkGoldenRod|DarkCyan|DarkBlue|Cyan|Crimson|Cornsilk|CornflowerBlue|Coral|Chocolate|Chartreuse|CadetBlue|BurlyWood|Brown|BlueViolet|Blue|BlanchedAlmond|Black|Bisque|Beige|Azure|Aquamarine|Aqua|AntiqueWhite|AliceBlue)\b/ 
			, _style: "color: green;"
		}
	}
};

LChiliBook.queue['js.js']= new Array;
LChiliBook.recipes['js.js'] = {
	  _name: 'js'
	, _case: true
	, _main: {
		  ml_comment: { 
			  _match: /\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\//
			, _style: 'color: gray;'
		}
		, sl_comment: { 
			  _match: /\/\/.*/
			, _style: 'color: gray;'
		}
		, string: { 
			  _match: /(?:\'[^\'\\\n]*(?:\\.[^\'\\\n]*)*\')|(?:\"[^\"\\\n]*(?:\\.[^\"\\\n]*)*\")/
			, _style: 'color: teal;'
		}
		, num: { 
			  _match: /\b[+-]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?\b/
			, _style: 'color: red;'
		}
		, reg_not: { //this prevents "a / b / c" to be interpreted as a reg_exp
			  _match: /(?:\w+\s*)\/[^\/\\\n]*(?:\\.[^\/\\\n]*)*\/[gim]*(?:\s*\w+)/
			, _replace: function( all ) {
				return this.x( all, '//num' );
			}
		}
		, reg_exp: { 
			  _match: /\/[^\/\\\n]*(?:\\.[^\/\\\n]*)*\/[gim]*/
			, _style: 'color: maroon;'
		}
		, brace: { 
			  _match: /[\{\}]/
			, _style: 'color: red; font-weight: bold;'
		}
		, statement: { 
			  _match: /\b(with|while|var|try|throw|switch|return|if|for|finally|else|do|default|continue|const|catch|case|break)\b/
			, _style: 'color: navy; font-weight: bold;'
		}
		, error: { 
			  _match: /\b(URIError|TypeError|SyntaxError|ReferenceError|RangeError|EvalError|Error)\b/
			, _style: 'color: Coral;'
		}
		, object: { 
			  _match: /\b(String|RegExp|Object|Number|Math|Function|Date|Boolean|Array)\b/
			, _style: 'color: DeepPink;'
		}
		, property: { 
			  _match: /\b(undefined|arguments|NaN|Infinity)\b/
			, _style: 'color: Purple; '
		}
		, 'function': { 
			  _match: /\b(parseInt|parseFloat|isNaN|isFinite|eval|encodeURIComponent|encodeURI|decodeURIComponent|decodeURI)\b/
			, _style: 'color: Purple; font-weight: bold;'
		}
		, operator: {
			  _match: /\b(void|typeof|this|new|instanceof|in|function|delete)\b/
			, _style: 'color: RoyalBlue; font-weight: bold;'
		}
		, liveconnect: {
			  _match: /\b(sun|netscape|java|Packages|JavaPackage|JavaObject|JavaClass|JavaArray|JSObject|JSException)\b/
			, _style: 'text-decoration: overline;'
		}
	}
};

LChiliBook.queue['html.js']= new Array;
LChiliBook.recipes['html.js'] = {
	  _name: 'html'
	, _case: false
	, _main: {
		  doctype: { 
			  _match: /<!DOCTYPE\b[\w\W]*?>/ 
			, _style: "color: #CC6600;"
		}
		, ie_style: {
			  _match: /(<!--\[[^\]]*\]>)([\w\W]*?)(<!\[[^\]]*\]-->)/
			, _replace: function( all, open, content, close ) {
				return "<span class='ie_style'>" + this.x( open ) + "</span>" 
					  + this.x( content, '//style' ) 
					  + "<span class='ie_style'>" + this.x( close ) + "</span>";
			}
			, _style: "color: DarkSlateGray; font-weight: bold;"
		}
		, comment: { 
			  _match: /<!--[\w\W]*?-->/ 
			, _style: "color: grey;"
		}
		, script: { 
			  _match: /(<script\s+[^>]*>)([\w\W]*?)(<\/script\s*>)/
			, _replace: function( all, open, content, close ) { 
				  return this.x( open, '//tag_start' ) 
					  + this.x( content, 'js' ) 
					  + this.x( close, '//tag_end' );
			} 
		}
		, style: { 
			  _match: /(<style\s+[^>]*>)([\w\W]*?)(<\/style\s*>)/
			, _replace: function( all, open, content, close ) { 
				  return this.x( open, '//tag_start' ) 
					  + this.x( content, 'css' ) 
					  + this.x( close, '//tag_end' );
			} 
		}
		// matches a starting tag of an element (with attrs)
		// like "<div ... >" or "<img ... />"
		, tag_start: { 
			  _match: /(<\w+)((?:[?%]>|[\w\W])*?)(\/>|>)/ 
			, _replace: function( all, open, content, close ) { 
				  return "<span class='tag_start'>" + this.x( open ) + "</span>" 
					  + this.x( content, '/tag_attrs' ) 
					  + "<span class='tag_start'>" + this.x( close ) + "</span>";
			}
			, _style: "color: navy;"
		} 
		// matches an ending tag
		// like "</div>"
		, tag_end: { 
			  _match: /<\/\w+\s*>|\/>/ 
			, _style: "color: navy;"
		}
		, entity: { 
			  _match: /&\w+?;/ 
			, _style: "color: blue;"
		}
	}
	, tag_attrs: {
		// matches a name/value pair
		attr: {
			// before in $1, name in $2, between in $3, value in $4
			  _match: /(\W*?)([\w-]+)(\s*=\s*)((?:\'[^\']*(?:\\.[^\']*)*\')|(?:\"[^\"]*(?:\\.[^\"]*)*\"))/ 
			, _replace: "$1<span class='attr_name'>$2</span>$3<span class='attr_value'>$4</span>"
			, _style: { attr_name:  "color: green;", attr_value: "color: maroon;" }
		}
	}
};


