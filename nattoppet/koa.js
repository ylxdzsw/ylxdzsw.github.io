(function() {
  $(function() {
    return $(".section-header").forEach(function(section, index) {
      section = $(section);
      section.attr('id', "section-" + index);
      return $("<li><a href=\"#section-" + index + "\">" + (section.text()) + "</a></li>").appendTo('#nav-menu');
    });
  });

}).call(this);
