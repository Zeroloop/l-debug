<?LassoScript 

	define_type:'Debug','Array',-prototype,-priority='replace',
		-description = '
				
			L-Debug - 	Integrated Debug Stack for Lasso
							www.L-Debug.org
							© Ke Carlton (www.zeroloop.com)
			
			
			
				//	Initialise debug stack
				
					debug->activate;

				//	Debug stuff
				
					debug("My Test String");
					debug->sql("SELECT * FROM test");';
					
		
		local(
			'id' = string,
		
			//	Debug Div CSS class
			'class'	= 'debug',
		
			//	Style / Interface elements	
			'js' 		= 'https://cdn.rawgit.com/zeroloop/l-debug/Lasso-8.6/debug.js',
			'chili' 	= 'https://cdn.rawgit.com/zeroloop/l-debug/Lasso-8.6/chili-L.js',
			'jquery' 	= 'https://code.jquery.com/jquery-1.4.4.min.js',
			'css' 		= 'https://cdn.rawgit.com/zeroloop/l-debug/Lasso-8.6/debug.js',
			
			'style' 	= string,
			
			//	Iterable types
			'iterable'	= 'Array,List,Map,Set,Tree',
			
			//	Timer locals
			'since' 		= integer,
			'startTime' = integer,
			'lastString'	= string,
			'opened'	= stack,
			'lastTime'	= decimal,
			
			//	Feedback stats
			'tags' 				= null,
			'variables'			= null,
			'clientHeaders' 	= null,
			'pageStartTime'	= null,
			
			//	Error tracking
			'lastErrorCode'	= 0,
			
			//	Overall Timer
			'timers'				= array,
			
			//	Custom Types / Blocks
			'types'				= array (
											'   Lasso Code' 	= 'lasso',
											'  JS Code' 		= 'js',
											'  CSS Code' 		= 'css', 
											' Timers' 			= 'timers',
											'Errors' 				= 'error',
											'Custom Tags' 	= 'customTags',
											'Render Code' 	= 'renderCode',
										),
			'settings'			= map(
											'sql'		= true,
											'xml'		= true,
											'html'		= true,
											'error'  	= true,
											'renderCode' = true,
											'headers'  	= true,
											'labels'  		= true,
											'types'  		= true,
											'lasso'  		= true,
											'css'  		= true,
											'js'  			= true,
										),
			
			//	Mode Settings
			'isActive'		= false,
			'mode'			= 'stack',
			
			//	Async Locals
			'asyncEvent'	= thread_event,
			'asyncWait'	= false,
			'threadID'		= integer,
		);
	
	
		define_tag:'onCreate', 
			-optional = 'object',
			-optional = 'time';
			
			//	Default to page level instance / variable
			if:	!local_defined('asLocal');		
				if:!var_defined('_L_debug') || local_defined('reset') || !var('_L_debug')->isA('debug') ;
					
					//	Define injection
					define_atEnd:{params->injectHTML} = @self;
					
					//	Set variable
					var('_L_debug') = @self;
					
					//	Load settings
					self->loadSettings;
					
				else;
					self = @var('_L_debug');
				/if;
			/if;
			
			//	isActive - can be passed a boolean or tag for evaluation
			local_defined('isActive') && local('isActive') != false 
			?	self->setActive(true);

			//	timerMode 
			local_defined('timerMode') 
			? 	self->setMode('timer');

			//	consoleMode 
			local_defined('consoleMode')  
			? 	self->setMode('console');
		
			//	Set locals
			local('js')->isA('string') 			? self->'js' 		= #js;
			local('css')->isA('string') 		? self->'css' 		= #css;
			local('style')->isA('style') 		? self->'style' 	= #style;
			local('jquery')->isA('string') 	? self->'jquery' 	= #jquery;
			
			//	Sleep if not active
			!	self->isActive
			?	return:@self;

			//	Wait for async events if is master thread
			self->'asyncWait' && self->isCurrentThread == 'true'
			?	self->'asyncEvent'->wait(1000);
			
			//	Set id
			!	self->'id' 
			?	self->'id' = lasso_uniqueid;
			
			//	Page Start time
			!	self->'pageStartTime' 
			?	self->'pageStartTime' = date_mSec;
			
			//	Block Start time
			!	self->'startTime' 
			?	self->'startTime' = date_mSec;

			//	Current Thread ID
			!	self->'threadID' 
			?	self->'threadID' = thread_getCurrentID;
			
			//	Grab current variable & tags

			!	self->'variables' 
			?	self->'variables' = variables->keys;

			!	self->'tags'->size
			?	self->'tags' = tags->keys;
		
			//	Snap shot client headers
			!	self->'clientHeaders' 
			?	self->'clientHeaders' = client_headers;
		
			//	Return self for local instances
			local_defined('asLocal') 	? return: @self;

			//	Return self and wait for async
			local_defined('async') 	? return: @self->async;
				
			//	Relay params to process
			params->size
			?	return: @self->\process->run(-params=@params,-owner=@self)
			|	return: @self;
		
		/define_tag;
		
		//	Return nothing...
		define_tag:'onConvert';
			return:string;
		/define_tag;
		
		//	Only allow for other debugs to overwrite self
		define_tag:'onAssign',-optional = 'object';
			if:local('object')->isA('debug');
				return:self;
			/if;
		/define_tag;

		
//============================================================================
//
//		->	Setting handlers
//
//............................................................................	
	
		define_tag:'settings';
			return:@self->'settings';
		/define_tag;
		
		define_tag:'setting',-req='what';
			return:@self->'settings'->find(#what);
		/define_tag;
		
		define_tag:'checked',-req='what';
			return(self->setting(#what) ? 'checked');
		/define_tag;
		
		define_tag:'loadSettings';
			
			local('settings')=map;

			//	Process cookie
			iterate:string(cookie('L-Debug',-path='/'))->split(';'),local('pair');
				#pair = string(#pair)->split(':');
				#pair->size != 2 ? loop_continue;
				
				// Convert booleans
				array('true','false') >> #pair->last 
				? #pair->last == boolean(#pair->last);
				
				// Save setting
				 #settings->insert(#pair->first=#pair->last);
			
			/iterate;
			
			#settings->size ? self->'settings' = #settings;	

		/define_tag;	
		
		
//============================================================================
//
//		->	Async Tags
//
//............................................................................	
		
		define_tag:'async';
			self->'asyncWait' = true;
			return:@self;
		/define_tag;		

		define_tag:'signal';
			self->'asyncEvent'->SignalAll;
			self->'asyncWait' = false;
			return:@self;
		/define_tag;		
	
		define_tag:'currentThread';
			return: thread_getCurrentID;
		/define_tag;		
		
		define_tag:'isCurrentThread';
			return:self->'threadID' == self->currentThread;
		/define_tag;		
		
//============================================================================
//
//		->	Status Tags
//
//............................................................................		
		
		define_tag:'isAjax',
			-description 	= 'Returns true if call is ajax';
			return: client_headers >> 'XMLHttpRequest';
		/define_tag;

		define_tag:'isActive';
			return:self->'isActive'->invoke;
		/define_tag;	

		define_tag:'activate';
			self->'isActive' = true;
			
			//	Set locals
			local('js')->isA('string') 			? self->'js' 		= #js;
			local('css')->isA('string') 		? self->'css' 		= #css;
			local('style')->isA('style') 		? self->'style' 	= #style;
			local('jquery')->isA('string') 	? self->'jquery' 	= #jquery;

			local('mode')->isA('string') 	? self->setMode(#mode);
			
		/define_tag;

		define_tag:'setActive',-optional='isActive';
			self->'isActive' = local('isActive');
		/define_tag;	

		define_tag:'deActivate';
			self->'isActive' = false;
		/define_tag;

		define_tag:'mode';
			return:self->'mode';
		/define_tag;	

		define_tag:'setMode',-optional='mode';
			self->'mode' = local('mode');
		/define_tag;	
	
//============================================================================
//
//		->	Process - This tag processes the parameters passed to L-Debug
//
//............................................................................	

		define_tag:'process',
			-optional = 'object';


				handle;
					//	Signal waiting any master threads
					local_defined('signal') 
					?	self->signal;
				/handle;

				//	Only function when active
				!	params->size || !self->isActive
				?	return:@self;

				//	Store current errors
				local(
					'error_code' = error_code,
					'error_msg' = error_msg 
				);
								
				//	Switch to timer mode
				if(self->mode == 'timer');
					self->\timerMode->run(-params=@params,-owner=@self);
					return(@self);
				/if;

				//	Inserts comment into seperate timer stack
				if:local_defined('time') || local_defined('timer');					
					
					if:local_defined('close') && !local('object')->size;
						self->'timers'->insert(self->lastOpenedText=pair(date_mSec = self->lastOpenedTime));	
					else;
						self->'timers'->insert(local('object')=date_mSec);
					/if;
					
					// If just a timer don't insert anything else into stack
					local_defined('timer') ? return(@self);
				/if;
				
				//	Switch to console mode
				if(self->mode == 'console');
					self->\consoleMode->run(-params=@params,-owner=@self);
					return(@self);
				/if;
				
				//	Build output string
				local(
					'comment' 	= self->render(-object=local('object')),
					'output'		= string,
				);
				
				//	Set to title if -open and param has been supplied.
				local_defined('open') && local('object')->isA('string') && !local_defined('title')
				?	local('title') = true;
				
				//	Strip excessive tabs
				#comment->replace('\t\t\t\t','\t');

				//	Style output string	
				select:true;
				
					case: local_defined('lasso');
						#output = '<code class="lasso">'encode_html(#object)'</code>';
						
					case: local_defined('html');
						#output = '<code class="html">'encode_html(#object)'</code>';

					case: local_defined('css');
						#output = '<code class="css">'encode_html(#object)'</code>';
						
					case: local_defined('js');
						#output = '<code class="js">'encode_html(#object)'</code>';
						
					case: local_defined('xml');
						#output = '<code class="xml">'encode_html(#object)'</code>';

					case: local_defined('sql');
						#output = '<code class="sql">'#object'</code>';

					case: local_defined('code');
						#output = '<pre class="code">'#object'</pre>';				

					case: local_defined('type');
						//	Store type 
						self->'types' !>> #type && #type 
						? self->'types'->insert(#type = self->safeCSS(#type));
						
						local_defined('open')
						?	#output = '<h3>'#type'</h3>'#comment 
						|	#output = '<span class="'self->safeCSS(#type)'"><label>'#type'</label><span class="type">'#comment'</span></span>';

					case: local_defined('header') && #object->isA('string'); 
						//	Only strings can be headers or titles
						#output = '<h2>'#object'</h2>';

					case: local_defined('title') && #object->isA('string'); 
						//	Only strings can be headers or titles
						#output = '<h3>'#object'</h3>';
						
					case;
						#output = '<span>'#comment'</span>';
					
				/select;
	
				select:true;
				
					//	Append millisecond calculation (base on supplied time)
					case:local_defined('time') && local('time') > 0;
						#output += '<span class="time">'self->since(#time)'</span>';
					
					//	If close then use last opened time
					case: local_defined('time') && local_defined('close') && self->hasOpen;
						#output += '<span class="time">'self->since(self->lastOpenedTime)'</span>';
								
					
					//	Append milleseconds since last timer
					case:local_defined('time');
						#output += '<span class="time">'self->since'</span>';
						
				/select;
				
				
				//	Wrap if error...
				local_defined('error')
				? #output = '<div class="error">'#output'</div>';

				//	Open & Close Block
				if:local_defined('open');
					#output = '<div'(local_defined('type')? ' class="'self->safeCSS(#type)'"')'>'+#output;
					self->'opened'->insertFirst(#comment = date_mSec);
				/if;
	
				//	If there's a current error then include it
				if:#error_code && #error_code != self->'lastErrorCode';
				 	self->'lastErrorCode' = #error_code;
				 	#output +=  '<div class="error">'#error_code': '#error_msg'</div>';
				 /if;
				
				if:	local_defined('close') && self->hasOpen;
					#output += '<div class="close"><br/></div></div>';
					self->'opened'->remove;
				/if;		
					
				//	Insert into stack
				self->insert(#output);	

				//	Always return self
				return:@self;
	
		/define_tag;

//============================================================================
//
//		->	Timer Mode
//
//............................................................................

		define_tag:'timerMode',-optional='object';
			
			local('time') = self->since;
			
			local(
				'class' = #time > 0.050 
								? 	'stupidSlow' 
								| 	#time > 0.020 
									? 	'reallySlow' 
									|	#time > 0.020 
										?	'quiteSlow',
				
				'comment' 	= string(local('object'))->subString(1,64),
				'lastString' = @self->'lastString',
				'lastTime' 	= @self->'lastTime',
			);
				
			//	Insert last insert with time taken
			#lastString->isA('string')
			?	self->insert('<div class="time '#class'">'#lastTime' - <b>'#time'</b> '#lastString' </div>');
		
			//	Set Comment for next insert
			#lastString 	= @#comment;
			#lastTime 	= self->pageProcessTime;
			
			return(@self);
			
		/define_tag;
		
		define_tag:'consoleMode',-optional='object';
			
			local('object')->type == 'null' ?	return(@self);
			
			local('result') = self->currentThread'\t'self->since'\t'string(local('object'));
			log_critical(#result);
			self->insert('<pre>'#result'</pre>');

			return(@self);
		
		/define_tag;

		define_tag:'xmlMode';
			//	Stub for future XML serialized mode.
		/define_tag;

		define_tag:'since',
			-optional = 'start';
			
			//	Simple timer
					
			local:'now' = date_msec;
			
			!	self->'since'
			? 	self->'since' = self->'startTime';

			local_defined('start')
			? 	local:'since' = #start 
			|	local:'since' = self->'since';
			
			!	local_defined('noUpdate')
			?	self->'since' = #now;

			return: math_mult((#now - #since),0.001);
			
		/define_tag;
		
		define_tag:'diff', 
			-optional = 'start', -type='integer',
			-optional = 'end', -type='integer';
			
			local('diff') = math_mult((#end - #start),0.001);
			return:#diff->setFormat(-precision=3)&;
		
		/define_tag;

		define_tag:'mSec';
			local('mSec') = string(date_mSec);
			return:#mSec->substring(#mSec->size-2,#mSec->size);
		/define_tag;
		
		define_tag:'pageProcessTime';
			local('time') = decimal(date_mSec - self->'pageStartTime',0.001)*0.001;
			return:#time;
		/define_tag;
		
		define_tag:'clientHeaders';
			return:@self->'clientHeaders';
		/define_tag;
		
		define_tag:'tags';
			return:@self->'tags';
		/define_tag;
		
		define_tag:'class';
			return:@self->'class';
		/define_tag;
		
		
//============================================================================
//
//		->	Open block tracking
//
//............................................................................		

		define_tag:'hasOpen';
			return:self->'opened'->size > 0;
		/define_tag;
		
		define_tag:'lastOpenedText';
			protect;
				return:self->'opened'->first->name;
			/protect;
		/define_tag;
		
		define_tag:'lastOpenedTime';
			protect;
				return:self->'opened'->first->value;
			/protect;		
		/define_tag;

		
//============================================================================
//
//		->	Insertion Tags
//
//............................................................................

		define_tag:'this';
			//	Used for local instances
			//	ie. #debug->this('My debug string');
			
			//	Relay params to process
			self->relay(@params);
			return:@self;
		
		/define_tag;

		define_tag:'found',-optional='what';
			self->process('Found 'found_count' 'local('what')' - 'error_msg);
		/define_tag;

		define_tag:'open';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-open);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'close';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-close);
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'closeWithTime';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-close);
			#params->insert(-time);
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'error';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-error);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'sql';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-sql);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'html';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-html);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'lasso';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-lasso);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'js';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-js);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'css';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-css);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'xml';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-xml);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'code';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-code);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'time',-optional='time';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-time=local('time'));	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'timer';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-timer);	
			self->relay(@#params);
			return:@self;
		/define_tag;

		define_tag:'header';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-header);	
			self->relay(@#params);
			return:@self;
		/define_tag;
		
		define_tag:'title';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-title);	
			self->relay(@#params);
			return:@self;
		/define_tag;
		
		define_tag:'anyError';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-anyError);	
			self->relay(@#params);
			return:@self;
		/define_tag;
		
		define_tag:'_unknownTag';
			local('params') = (params->isA('array') ? params | array);
			#params->insert(-type=tag_name);	
			self->relay(@#params);
			return:@self;
		/define_tag;
		
		

//============================================================================
//
//		->	Relay - Passes parameters to process tag
//
//............................................................................


		define_tag:'relay',-optional='params';
			self->\process->run(-params=@local('params'),-owner=@self);
		/define_tag;


//============================================================================
//
//		->	HTML Output
//
//............................................................................


		define_tag:'content';
			local('output' = string);
				#output += '<form class="filter">
										<table cellspacing=0>
										<tr>
											<td rowspan="2">
												<h1>L-Debug</h1>
											<td>
											<td>
												<label><input type="checkbox" name="headers" 'self->checked('headers')' />Headers</label>
												<label><input type="checkbox" name="labels" 'self->checked('labels')' />Labels</label>
												<label><input type="checkbox" name="types" 'self->checked('types')' />Types</label>
											</td>
											<td>
												<label><input type="checkbox" name="HTML" 'self->checked('HTML')' />HTML</label>
												<label><input type="checkbox" name="SQL" 'self->checked('SQL')' />SQL</label>
												<label><input type="checkbox" name="XML" 'self->checked('XML')' />XML</label>
											</td>
											<td>
												<label><input type="checkbox" name="variables" 'self->checked('variables')' />Variables</label>
												<label><input type="checkbox" name="clientHeaders" 'self->checked('clientHeaders')' />Client Headers</label>
												<label><input type="checkbox" name="more" 'self->checked('more')' .>More...</label>
											</td>
											<td valign=bottom class="search">
												<pre>'self->pageProcessTime' secs - 'date->format('%H:%M:%S')'.'(self->mSec)'</pre>
												<span>Filter <i>(Case sensitive)</i><br/>
												<input type="text" name="search" value="'self->setting('search')'"></span>
											</td>
										</tr>
										</table>
										
										<div class="more">'self->extraTypes'</div>
										
									</form>';
									
									
				
				#output += 	'<div class="clientHeaders">'encode_html(self->clientheaders)'</div>';
				#output += 	'<div class="customTags">'self->customTags'</div>';
				#output += 	'<div class="variables">'self->variables'</div>';
				#output += 	'<div class="timers">'self->timers'</div>';
				#output += 	'<div class="results">'self->join(string)'</div>';
				return:@#output;
		/define_tag;
		
//============================================================================
//
//		->	extraTypes - Custom / Extra checkboxes
//
//............................................................................		
		define_tag:'extraTypes';
			local(
				'output' = string,
				'types' = self->'types', 
			);
			local('every') = math_floor(math_max(3,#types->size/4.0));
			
			#types->sort;
				
			#output += '<table>';
			
			if:#types->size;
				#output+='<tr valign="top"><td>';
				iterate:#types,local('pair');
					#output += '<label><input type="checkbox" name="'#pair->value'" 'self->checked(#pair->value)'>'#pair->name'</label>';
					!((loop_count) % #every) && loop_count != 1? #output += '</td><td>'; 					
				/iterate;
				#output+='</td><td colspan="99"></td></tr>';
			/if;
									
			#output += '</table>';
			
			return(#output);
		/define_tag;
		
		define_tag:'safeCSS',-optional='label';
			return:string(#label)->replace(' ','')&;
		/define_tag;
		

//============================================================================
//
//		->	Render - Object to HTML renderer
//
//............................................................................

		define_tag: 'render',
			-optional 		= 'object',
			-description 	= 'Renders objects as loose html';
			
			local: 'return' = string;

			if: self->'iterable' >> #object->type || #object->isA('map');
				
				!	#object->size
				? 	return:  '<span class="type"><i>'+string(#object->type)->titleCase&+'</i></span>';
		
				//	Render object
				#return += '<span class="type"><i>'+string(#object->type)->titleCase&+'</i><ul>';
	
				//	Render object items
				iterate:#object,local('item');
					#return += '<li>'self->render(-object = #item)'</li>';
				/iterate;
		
				#return += '</ul></span>';
				
			else:local('object')->isA == 'debug';
				#return = '<div>'#object->content'<div class="close"/></div>';
			else:local('object')->type == 'pair';
		
				//	Render Pair
				#return = 	'<label>'#object->first': '
									('string,decimal,integer,boolean' >> #object->second->type 
									?	'<b>'encode_html(string(local('object')->second))'</b></label>'
									|	'</label>'self->render(-object=#object->second));
			
			else;
				#return += '<span class="string">'encode_html(string(local('object')))'</span>';
			/if;
		
			return:@#return;
		
		/define_tag;			

//============================================================================
//
//		->	asHTML - Outputs debug stack as HTML
//
//............................................................................		

		define_tag:'asHTML';
			if:self->isActive;
				local('output' = string);

				#output += self->injectJS;
				#output += self->injectCSS;
				#output += self->style;
				#output += '<div class="'self->class'">';
				#output += self->content;
				#output += '</div>';	
				
				return:#output;
				
			else;
				return:string;
			/if;
		/define_tag;

//============================================================================
//
//		->	injectHTML - Inserts self into current page
//
//............................................................................
		
		define_tag:'injectHTML';
		
			!	self->isActive
			?	return;

			//	Only modify text/html
			content_type != 'text/html' && content_type ? return; 

			//	Ensure content body is a string
			!	content_body->isA('string')
			?	content_body = string(content_body);
			
			if:self->isAjax;
				//	Update existing debug stack
				//	Assume debug js exists				
				content_body += '<script>$("div.debug:last").html(unescape("'encode_strictURL(self->content)'"));setTimeout(setupDebug,100);</script>';
		
			else: content_body >> '<div class="debug">';
			
				content_body += '<script>$("div.debug:last").html(unescape("'encode_strictURL(self->content)'"));</script>' + self->injectJS + self->injectCSS;	
		
			else:content_body >> '</body>';
				//	Insert cleanly into html body
				content_body->replace('</body>',self->asHTML'</body>');

			else;
				//	Tack onto end of output
				content_body += self->asHTML;
			/if;
		
		/define_tag;
		
//============================================================================
//
//		->	Variables - Returns variables created after -> activate
//
//............................................................................

		define_tag:'variables';

			local(
				'output' = string,
				'size' = '-', 
				'var' = null,
			);
			
			#output+='<table cellspacing=0>';
			#output+='<tr><th>Variable Name</th><th>Type</th><th>Size</th></tr>';
			
			iterate:variables->keys->sort&,local('name');
				#var = @variables->find(#name);
				protect;#size=#var->size;/protect;
				#output+='<tr><td>'#name'</td><td>'#var->type'</td><td>'#size'</td></tr>';
				#var->detachReference;
				#size = '-';
			/iterate;
			
			#output+='</table>';

			return:#output;
			
		/define_tag;

//============================================================================
//
//		->	Custom Tags - Returns custom tags created after -> activate
//
//............................................................................
		
		define_tag:'customTags';
			
			local(
				'output' = string,
				'tag' = null, 
			);
			
			#output+='<table cellspacing=0>';
			#output+='<tr><th>Tag Name</th><th>Type</th></tr>';
			
			iterate:tags->keys,local('name');
				self->tags >> #name ? loop_continue;
				#tag = @tags_find(#name);
				#output+='<tr><td>'#name'</td><td>'#tag->type'</td></tr>';
				#tag->detachReference;
			/iterate;
			
			#output+='</table>';

			return:#output;
			
		/define_tag;

//============================================================================
//
//		->	Timer - Renders external timer
//
//............................................................................
		
		define_tag:'timers';

			local(
				'output' = string,
				'start'	= integer(self->'startTime'),
				'last'		= integer(self->'startTime'),
				'newLast'= 0,
				'total'		= self->pageProcessTime,
				'max'		= 0,
				'time' 	= integer,
			);
			
			#output+='<table cellspacing=0>';
			#output+='<tr><th>Time</th><th>Seconds</th><th>Name</th></tr>';
			
			iterate:self->'timers',local('pair');
					if:#pair->value->isA('pair');
						#time 	= integer(#pair->value->name);
						#last  	= integer(#pair->value->value);
					else;
						#time 	= integer(#pair->value);
					/if;
					
					#max = math_max(#max,self->diff(#last,#time));
					#last 	= #time;
					
			/iterate;

			#last = #start;


			iterate:self->'timers',local('pair');
				! #pair->name  ? loop_continue;
	
	
				if:#pair->value->isA('pair');
					#last 		= integer(#pair->value->value);
					#time 		= integer(#pair->value->name);
				else;
					#time 		= integer(#pair->value);
				/if;
				
				local('sinceStart') = self->diff(#start,#time);
				local('sinceLast') = self->diff(#last,#time);
				local('perc') = Math_round(100*(#sinceLast / #total),1);
				local('percCSS') = Math_round(100*(#sinceLast / #max),1);
				
				#output+='<tr valign="top"><td>'#sinceStart'</td><td>'#sinceLast'</td><td>'#pair->name'</td><td class="perc"><div style="width:'#percCSS'%">&nbsp;</div></td><td>'#perc'%</td></tr>';
				
				#last = #time;

			/iterate;
			
			#output+='</table>';

			return:#output;
			
		/define_tag;
			
//============================================================================
//
//		External resources - these tags include links to external dependics if they do not exist on the current page.
//
//............................................................................
	
		define_tag: 'injectJS';
			//	Returns missing JS src
			local(
				'js' 		= @self->'js',
				'chili' 	= @self->'chili',
				'jquery' 	= @self->'jquery',
				'output'	= string,
			);

			//	Only modify text/html
			content_type != 'text/html' && content_type ? return; 

			//	Ensure content body is a string
			!	content_body->isA('string')
			?	content_body = string(content_body);

			//	Add JQuery
			if:!string_findRegExp(content_body,-find= 'jquery.*?\\.js')->size && content_body !>> 'google.load("jquery'; 
				content_body >> '</head>'
				?	content_body->replace('</head>','<script type="text/javascript" src="'#jquery'"></script>\r</head>') 
				|	! isAjax ? #output += '<script type="text/javascript" src="'#jquery'"></script>';
			
			/if;
			
			
			if:self->setting('renderCode');
				
				//	Add Chili code renderer 
				if:content_body !>> 'chili-L.'; 
					content_body >> '</head>'
					?	content_body->replace('</head>','<script type="text/javascript" src="'#chili'"></script>\r</head>') 
					|	! isAjax ? #output += '<script type="text/javascript" src="'#chili'"></script>';
				/if;
			
			/if;
			
			//	Add debug.js 
			if:content_body !>> 'debug.js'; 
				content_body >> '</head>'
				?	content_body->replace('</head>','<script type="text/javascript" src="'#js'"></script>\r</head>') 
				|	! isAjax ? #output += '<script type="text/javascript" src="'#js'"></script>';
			/if;
			
			return:#output;
		/define_tag;
		
		define_tag: 'injectCSS';
			//	Returns debug CSS links

			//	Only modify text/html
			content_type != 'text/html' && content_type ? return; 

			//	Ensure content body is a string
			!	content_body->isA('string')
			?	content_body = string(content_body);			
			
			local('css') =  @self->'css';
			if:content_body !>> 'debug.css';
				content_body >> '</head>' 
				?	content_body->replace('</head>','<link rel="stylesheet" href="'#css'" type="text/css" />\r</head>') 
				|	return('<link rel="stylesheet" href="'#css'" type="text/css" />\r</head>');
			/if;
		/define_tag;
	
		define_tag: 'style';
			//	Returns any extra CSS style
			self->'style' 
			?	return: '<style>' + self->'style' + '</style>';
		/define_tag;


	/define_type;

?>
