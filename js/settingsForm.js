
$(function() {
    
    var url = $('input[name=markupHostURL]').val();
    
    // stop here if host url not available
    if (url == '')
        return;
    
    var $cslStyleSelector = $('select[name=cslStyle]');
    
    url = $.trim(url).replace(/\/$/, '') + '/api/job/citationStyleList';
    
    // remove all options
    $cslStyleSelector.children('option').each(function() { this.remove(); });
    
    
    $.ajax({
        url: url,
        type: 'GET',
        dataType: 'json',
        success: function(data){ 
            if (!data.citationStyles) 
                return;
            
            var $option = null;
            var citationStyles = data.citationStyles;
            for (var hash in citationStyles) {
                if (citationStyles.hasOwnProperty(hash)) {
                    $option = $('<option></option>').attr('value', hash).text(citationStyles[hash]);
                    
                    if (cslStyleSelection == hash) {
                        $option.attr('selected', 'selected');
                    }
                            
                    $cslStyleSelector.append($option);
                }
            }
        },
        error: function() {
            alert('Unable to fetch citation styles');
        }
    });
    
});