## Infravision

Dwaves, Elves, and Halflings have Infravision, allowing them to see in the dark. Dwarves and Elves can see in the dark up to 60'. Halflings can see in the dark up to 30'. This is pretty easy to set up in Foundry, assuming your scenes are following the default lighting setup.


Open the character sheet for the character you want to grant Infravision to. Click **Prototype Token,** then **Vision**.

![Vision](docs/user-guide/images/vision.png)

Make sure **Has Vision** is checked. This needs to be checked for every player token anyway. Then you can set either **Bright Vision** or **Dim Vision** to the distance the class can see. Dim or Bright are the same thing functionally within Foundry and the DCC system. The only difference is that **Bright Vision** looks a little brighter on the screen. Click **Update Token** and drag a new copy of that token onto the scene. Click the token and you wll see their vision.


## Torches

Torches work just a little bit differently. You can set up the character to produce light from their token, like a torch, lantern, or a magic item. Open the **Prototype Token** dialog again and look for **Dim Light Radius** and **Bright Light Radius**. Set these two whatever distance you feel fits. Generally, a good distance for a torch is 30' Dim, 15' bright. This reflects the light being brighter as you get closer to the torch. Then select the **Light Animation Type** dropdown and pick Torch.

![Torches](docs/user-guide/images/torches.png)

The character token will now produce a flickering light that **all** players can see, as long as they have vision.



