var calipso = require("../../lib/calipso");      

exports = module.exports = {init: init, route: route};

/**
 * Base content module
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function route(req,res,module,app,next) {      

      
      /**
       * Menu items
       */      
      res.menu.admin.primary.push({name:'Admin',url:'/admin',regexp:/admin/});
        
      /**
       * Routing and Route Handler
       */                  
      module.router.route(req,res,next);
                                                                
}

function init(module,app,next) {      
  
  calipso.lib.step(
      function defineRoutes() {
        
        module.router.addRoute('GET /admin',showAdmin,{template:'admin',block:'admin',admin:true},this.parallel());
        module.router.addRoute('GET /admin/reload',reloadAdmin,{template:'reload',block:'admin',admin:true},this.parallel());
        module.router.addRoute('POST /admin/save',saveAdmin,{admin:true},this.parallel());        
        
        // TODO: Disable these routes once you have installed 
        module.router.addRoute('GET /admin/install',install,{template:'install',block:'admin'},this.parallel());  
        module.router.addRoute('POST /admin/install',installSave,null,this.parallel());
      },
      function done() {
        
        calipso.data.themes = [];        
        calipso.lib.fs.readdir(app.path + '/themes',function(err,folders) {
          
           folders.forEach(function(name){
             calipso.data.themes.push({name:name,selected: app.set('config').theme === name ? true : false}); 
           });
           
           calipso.data.loglevels = calipso.lib.winston.config.npm.levels;           
           calipso.data.modules = calipso.modules;
           
           next();
        });
        
      }        
  );
    
    // Admin schemas are defined in Configuration.js
    

}

function install(req,res,template,block,next) {      
    
    // If not in install mode, do not show this form
    if(!calipso.app.doingInstall) {
      res.redirect("/");
      next();
      return;
    }
    
    calipso.theme.renderItem(req,res,template,block,{});                         
    next();
                      
};


function installSave(req,res,template,block,next) {      
      
    // Temporary fix to admin
    req.registerAdmin = true;
  
    var user = require("../user/user.module");
    user.registerUser(req,res,template,block,function() { 
        req.flash('info','New administrative user created, you can now login as this user and begin using calipso!');      
    });
      
    // RUn the module install scripts
    for(var module in calipso.modules) {        
      // Check to see if the module is currently enabled, if so install it
      if (calipso.modules[module].enabled && typeof calipso.modules[module].fn.install === 'function') {     
        calipso.modules[module].fn.install();
      }    
    }

};

function showAdmin(req,res,template,block,next) {      
    
  // Re-retrieve our object
  res.layout = "admin";
  
  var AppConfig = calipso.lib.mongoose.model('AppConfig');    
  
  AppConfig.findOne({}, function(err,config) {                    
          var item = {id:config._id,type:'config',meta:config.toObject()};                
          calipso.theme.renderItem(req,res,template,block,{item:item});
          next();          
  });
                      
};

function reloadAdmin(req,res,template,block,next) {  
  
  res.reloadConfig = true;    
    
  var item = {id:'0',type:'config',meta:{reload:true}};      
  
  calipso.theme.renderItem(req,res,template,block,{item:item});
  
  next();

  
}

function saveAdmin(req,res,template,block,next) {
                        
      calipso.form.process(req,function(form) {
         
         if(form) {                 
           
           // Re-retrieve our object
           var AppConfig = calipso.lib.mongoose.model('AppConfig');    
           
           AppConfig.findOne({}, function(err,c) {    
                       
             if (!err && c) {                        
           
                if(c.theme != form.config.theme) {
                  req.flash('info','You need to restart calipso to see the theme changes (live restart todo!).')
                }
                
                c.theme = form.config.theme;
                c.cache = form.config.cache;        
                c.logs.level = form.config.logslevel;
                c.logs.file.enabled = form.config.logsfileenabled === 'on' ? true : false;        
                c.logs.file.filepath = form.config.logsfilefilepath;
                c.logs.console.enabled = form.config.logsconsoleenabled  === 'on' ? true : false;
                                                
                c.modules = moduleFormatToArray(res,form.config.modules);        
                
                c.save(function(err) {                              
                  if(err) {
                    req.flash('error','Could not update config: ' + err.message);
                    if(res.statusCode != 302) {  // Don't redirect if we already are, multiple errors
                      res.redirect('/admin');
                    }
                  } else {
                    calipso.log(c);
                    calipso.config = c; // TODO : This wont work on multiple edits
                    res.redirect('/admin/reload');
                  }                  
                  next();         
                });
                        
            } else {
              req.flash('error','Could not locate configuration!');
              res.redirect('/admin');
              next();
              
               
            }
      });      
       
    } else {
     
      req.flash('error','Could not process form data!');
      res.redirect('/admin');
      next();
           
    }
    
  });
  
}

function moduleFormatToArray(res,modules) {
  
  var arrayModules = [];
  
  for(var module in calipso.modules) {                     
     var enabled = modules[module] === 'on' ? true : false;
     arrayModules.push({name:module,enabled:enabled});    
  }
  
  return arrayModules;
  
}