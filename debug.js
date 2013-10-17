function setupDebug(){
	
	$('div.debug form.filter').unbind().submit(function(){
		form = $(this);
		target = form.parents('div.debug');
		search = form.find('input[name=search]').val();
		hash = '';
		
		// Generate form hash
		
		form.find('input').each(function(){
			$(this).attr('type') == 'checkbox'
			? hash = hash + ($(this).attr('checked')==true?'1':'0')
			: hash = hash + $(this).val();
		});
		
		//	Display toggles
		
		showHeaders	= form.find('input[name=headers]').attr('checked');
		showLabels	= form.find('input[name=labels]').attr('checked');
		showTypes	= form.find('input[name=types]').attr('checked');

		showHTML	= form.find('input[name=HTML]').attr('checked');
		showXML		= form.find('input[name=XML]').attr('checked');
		showSQL		= form.find('input[name=SQL]').attr('checked');
		
		//showVariables		= form.find('input[name=variables]').attr('checked');
		//showClientHeaders	= form.find('input[name=clientheaders]').attr('checked');
		showTimers			= form.find('input[name=timers]').attr('checked');
		showErrors			= form.find('input[name=errors]').attr('checked');
		showMore			= form.find('input[name=more]').attr('checked');

	
		if (form.attr('lastSearch') != search){
			target.find('.match').removeClass('match');
			target.children().not('form').find(':hidden').show();
		}


		//showClientHeaders 	? target.find('div.clientHeaders').slideDown(150) : target.find('div.clientHeaders').slideUp(100); 
		showTimers 			? target.find('div.timers').slideDown(150) : target.find('div.timers').slideUp(100); 
		showErrors 			? target.find('.errors').slideDown(150) : target.find('div.errors').slideUp(100); 
		showMore 			? target.find('div.more').slideDown(150) : target.find('div.more').slideUp(100); 		
		
		if(search != '' && form.attr('lastHash') != hash) {
			//	Don't target results (there's a search)
			form.find('table:last input[type=checkbox]').each(function(){
				label = $(this).attr('name');
				$(this).attr('checked')
				?	target.children('.'+label).slideDown(150).find('*').show()
				:	target.children('.'+label).slideUp(100);
			});
		}else{
			//	Simply show/hide elements
			form.find('table:last input[type=checkbox]').each(function(){
				label = $(this).attr('name');
				$(this).attr('checked')
				?	target.find('.'+label).slideDown(150).find('*').show()
				:	target.find('.'+label).slideUp(100);
				
				saveDebug(form)
			});
		}

		if(search != '' && form.attr('lastSearch')!=search){
			
			target.children('div.results').find('*').not('.close').hide();
			    
			show = function(){
			    match = $(this);
			    cssClass = match.attr('class');
			    if(cssClass == 'type'){
			        match.siblings('label').show();
			        match.children('i').show();
			    }else if(cssClass=='string'){
			        match.addClass('match');
			        match.siblings('h3').show();
				}
				
			    match.show();
			    match.parents().show();
			}
			showLabel = function(){
			   	$(this).parents().show();
			    $(this).show().addClass('match');
			    $(this).find('*').show();
				$(this).next('.type').find('*').show();
			}
			showType = function(){
			   	$(this).parents().show();
			    $(this).show().addClass('match');
			    $(this).find('*').show();
			}
			showCode = function(){
			   	$(this).parents().show();
			   	$(this).siblings('h3').css('display','block');
			    $(this).css('display','block');
			    $(this).find('*').show();
			}
			showNext = function(){
			    $(this).show().addClass('match');
			    $(this).parents().show();
			    $(this).siblings().show().find('*').show();
			}
			target.find('span:contains('+search+')').each(show);
			target.find('code:contains('+search+')').each(showCode);
			target.find('i:contains('+search+')').each(showType);
			target.find('label:contains('+search+')').each(showLabel);
			target.find('h3:contains('+search+')').each(showNext );	
		}
		
		//	Cache search for performance
		form.attr('lastSearch',search);
		form.attr('lastHash',hash);
		saveDebug(form)
	
		return false;
	});	
	
	
	//	Bind Headers
	$('div.debug div.results h3').each(function(){
		host = $(this).parent();
		$(this).unbind().click(function(){
			host = $(this).parent();
			hasClosed = (host.find(':hidden').length > 0);

			if(hasClosed){
				host.find(':hidden').css('display','block');
				//host.find(':hidden').show();
			}else
				host.children().not(this).hide().find('.').hide();

		});
		if(host.children().length > 1)
			$(this).addClass('hasChildren');
	});
	
	//	Timer
	//$('div.debug form.filter pre').unbind().click(function(){
	//	$('div.debug input[value=timers]').attr('checked',$('div.debug div.timers').attr('display')!='none');
	//	$('div.debug div.timers').slideToggle(100);
	//});
	
	//	Bind checkboxes
	$('div.debug form.filter input[type=checkbox]').unbind().change(function(){
		$(this).parents('form.filter').submit();
	})
	
	//	Bind timer expansion
	$('div.debug div.timers').unbind().click(function(){
		$(this).toggleClass('expanded')
	})


	//	Bind timer expansion
	$('div.debug div.error').unbind().click(function(){
		$(this).find('div').toggleClass('expanded')
	})
	
	
	//	Bind timer expansion
	$('div.errorstack footer').unbind().click(function(){
		$(this).toggleClass('expanded')
	})
	
	//	Update all stacks on setup
	$('div.debug form.filter').submit();
	
}

function saveDebug(form){
	//	Set cookie;
	var cookie = '';
	form.find('input').each(function(){
		($(this).attr('type')=='checkbox')
		?	cookie += $(this).attr('name')+':'+($(this).attr('checked')?true:false)+';' 
		:	cookie += $(this).attr('name')+':'+$(this).val()+';';
	});
	document.cookie = "L-Debug="+escape(cookie)+"; path=/";
}

// Timeout for lazy browsers
setTimeout(setupDebug,300);

//	Prepare setup
$(document).ready(setupDebug)