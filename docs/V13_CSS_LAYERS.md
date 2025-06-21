FoundryVTT V13 Layered Theme System: Complete Guide
What is the Layered Theme System?
FoundryVTT V13 introduced CSS Cascade Layers, a modern CSS standard that allows developers to take more active control over the order in which CSS rules are applied. This makes it easier to isolate certain groups of rules to certain parts of the page and is particularly useful for module and system authors who often need to isolate heavily styled app windows from Foundry's built-in styles. FoundryvttFoundryvtt
On the technical side, Foundry has fully implemented CSS Layers, which is a big benefit to modules and systems making it easier for them to override core styles without needing to match the same level of specificity of the core rule. All system and module defined styles are automatically opted in to this feature. GitHub - cswendrowski/FoundryVTT-Custom-CSS: Allows a user to setup custom CSS rules in a FoundryVTT world
Why Was This System Introduced?
CSS was originally designed to write styles for a document where a single author would be in control of the whole thing. Increasingly though, web apps may contain multiple parts managed by different teams, and in the past it's been a challenge to prevent cascade conflicts. A cascade conflict occurs when multiple CSS rules target the same element with different style declarations. Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
This would manifest as module authors having to use "specificity hacks" to make their styles "win" against the Foundry built-ins. CSS is no longer hot reloaded · Issue #11939 · foundryvtt/foundryvtt
The Layer Hierarchy
The full list of layers that Foundry v13.334 defines is as follows, in reverse declaration order (first layer is highest priority): Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
base          △ highest priority / declared last
specific      |
general       |
exceptions    |
exceptions.prosemirror |
modules       |
system        |
layouts       |
layouts.responsive | nested layers have lower priority than parents
layouts.views | even if declared later
layouts.full  |
compatibility |
applications  |
blocks        |
blocks.ui     |
blocks.base   |
elements      |
elements.custom |
elements.forms |
elements.media |
elements.typography |
variables     |
variables.themes |
variables.base |
reset         ▽ lowest priority / declared first
Key points about the hierarchy:

System layer has priority over all of Foundry's built-in styles
Modules layer has priority over system (and therefore also over Foundry's built-ins)
general, specific, and base are not mentioned in the official documentation, but are used in the core Foundry CSS. They are probably not intended for use by developers. Foundry's Built-in CSS Framework | Foundry VTT Community Wiki

How to Implement in Your Existing System
1. Basic Implementation (Automatic)
   If you include your CSS the normal way, by listing it in your manifest (module.json or system.json), Foundry v13 and later will automatically import it into either the module or the system layer, as appropriate. FoundryvttGitHub
   For a system (system.json):
   json{
   "styles": ["styles/system-styles.css"]
   }
   For a module (module.json):
   json{
   "styles": ["styles/module-styles.css"]
   }
   This one change means that your system or module styles will always beat conflicting styles that are built-in, with no extra work from you. Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
2. Advanced Implementation (Specific Layer Targeting)
   You can use object syntax to import your CSS into any layer. For example, in module.json, this would import mymodule.css into the module layer but add myvariables into the variables layer: Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
   json{
   "styles": [
   "mymodule.css",
   {
   "src": "myvariables.css",
   "layer": "variables"
   }
   ]
   }
3. Full Control Implementation
   If you want to take full control of the layers used in your CSS, you can use null as the value for layer. The stylesheet will not be added to any layer, and will always take precedence over all layered rules: Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
   json{
   "styles": [
   {
   "src": "myverycleverstylesheet.css",
   "layer": null
   }
   ]
   }
   ⚠️ Warning: If you do use "layer": null, and don't manually wrap your CSS in @layer {...} rules, your CSS will all end up in the default/unlayered group, which takes precedence over all layered rules. This will not play nicely with code that expects layers. Your CSS will have precedence over the exceptions layer, so nobody will be able to use that layer to override your CSS. Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
   Advanced Techniques
   Layer Reversion
   One of the benefits of using CSS layers is that authors can now specifically revert a particular layer within a particular context. Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
   For example, if you want to completely opt out of Foundry's typography styles in your system:
   css@layer elements.typography {
   .application.my-system .window-content {
   &, & * {
   all: revert-layer;
   }
   }
   }
   This technique allows you to:

Target specific layers: Named layers are always open for adding, so even though the layer doesn't belong to us, we can still add to it. Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
Revert unwanted styles: The revert-layer value makes properties go back to whatever they were in the layer below the current one.

Custom CSS Within Layers
You can also manually organize your CSS using @layer rules:
css/* In your CSS file */
@layer system {
.my-system .character-sheet {
background: #f0f0f0;
border: 1px solid #ccc;
}
}

@layer variables {
:root {
--my-system-primary-color: #2196F3;
--my-system-secondary-color: #FFC107;
}
}
Migration Strategy for Existing Systems
Phase 1: Immediate Compatibility

No changes required initially - The core team has added a compatibility layer which means that anything using V1 styles should stay the same. Foundry's Built-in CSS Framework | Foundry VTT Community Wiki
Update your system.json to ensure CSS files are properly declared in the styles array
Test your system with V13 to identify any style conflicts

Phase 2: Optimize for Layers

Reorganize CSS files by purpose:

variables.css for CSS custom properties
elements.css for basic element styling
application.css for application-specific styles


Update manifest to target specific layers:

json{
"styles": [
{
"src": "styles/variables.css",
"layer": "variables"
},
{
"src": "styles/elements.css",
"layer": "elements.custom"
},
"styles/application.css"
]
}
Phase 3: Advanced Implementation

Use layer reversion for conflicting Foundry styles
Implement proper CSS organization within your stylesheets using @layer
Test cross-module compatibility to ensure your layers play well with others

Best Practices

Start Simple: Begin with automatic layer assignment before moving to manual layer targeting
Use Descriptive Layer Names: When creating custom layers, use clear, descriptive names
Document Your Layer Strategy: Keep track of which styles go in which layers
Test Extensively: Verify compatibility with popular modules and other systems
Avoid layer: null unless absolutely necessary, as it breaks the layer ecosystem

Common Issues and Solutions
Hot Reloading Problems
CSS is no longer hot reloaded in V13 because packages now use <style>@import "…" layer(…);</style>, resulting in nothing being reloaded when using the traditional hot reload mechanism. Year in Review: Five-Year Anniversary Edition | Foundry Virtual Tabletop
Solution: You may need to refresh the page or restart Foundry when developing CSS changes.
Specificity Conflicts
With layers, specificity becomes less important, but you still need to understand layer precedence.
Solution: Place your styles in the appropriate layer rather than increasing CSS specificity.
Tools and Resources

Browser Developer Tools: Use the CSS inspector to see which layer styles are coming from
CSS Layer Inspector: Modern browsers show layer information in their developer tools
Community Wiki: The Foundry VTT Community Wiki has comprehensive documentation on CSS Cascade Layers Foundry's Built-in CSS Framework | Foundry VTT Community Wiki

Future Considerations
Community developers can rejoice as Foundry has migrated entirely to using CSS Layers for Foundry VTT-controlled UI elements, which should make it easier for developers to more specifically target and reskin the UI while also making it easier to identify just how far those changes are going to go. foundryvtt/articles/canvas-layers.html at master · foundryvtt/foundryvtt
This system represents a significant improvement in how CSS conflicts are resolved and provides a much cleaner development experience for system and module creators. By implementing these techniques, you'll ensure your system works harmoniously with the new V13 architecture while maintaining clean, maintainable code.RetryClaude can make mistakes. Please double-check cited sources.Researchbeta Sonnet 4
