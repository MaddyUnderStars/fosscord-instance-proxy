# Instance Proxy

- Routes traffic from a client to multiple Fosscord instances, and vice versa
- Merges the multiple gateway connections into a single one for client

WIP replacement for [Fosscord-BD](https://github.com/MaddyUnderStars/fosscord-bd).
This approach works regardless of client-mod or client. As long as it can connect to the proxy, it will work.

This code is very Jank™. Many things don't work, and this is basically just a proof of concept. For example:

- Attachments/uploading don't work
- ID routing sometimes breaks, leading to requests sent to the wrong instance
- Instances sending responses for newer client versions will break things
- The Discord.com font doesn't load, for some reason
- Pretty sure only a single user can log in to the proxy at a time?
- Permission checking doesn't work as the client user ID and instance IDs don't match (replacement is broken atm)
- I wouldn't trust this to not get you banned on Discord.com at the moment
- It seems you get logged out on every reload. Although, the proxy doesn't actually care about your login details, as tokens are stored in settings.json
- Much more!

## Usage

```sh
npm i
npm run build
npm run start
```

Make sure to create a settings.json file and to create a `.env` file (see `.env.template`).

## `settings.json`

Located in the project root, an example settings file looks like:

```json
{
  "instances": [
    {
      "name": "Staging",
      "baseUrl": "https://staging.fosscord.com",
      "api": "https://staging.fosscord.com/api/v9",
      "token": "your login token"
    }
    // ... as many as you want
  ],
  "defaultInstance": 0, // index of instances array. used as fallback + for client src
  "user": {
    "id": "whatever ID you want your fake user to have, really",
    "username": "Your fake user's username",
    "email": "you get it",
    "discriminator": "08435385",
    "verified": true,
    "avatar": "aaaaaaaaaaaa",
    "banner": "bbbbbbbbbbb"
  }
}
```

The `user` object in there is just what the clients connected to the proxy are told, not what is given to instances. If my code worked, all mentions of a instance user ID you own, along with its data, would be replaced with the fake user specified here.
