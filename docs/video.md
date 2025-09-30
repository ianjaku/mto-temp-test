# Transcoder settings

## Typical transcoding settings
* LD 240p 3G Mobile @ H.264 baseline profile 350 kbps (3 MB/minute)
* LD 360p 4G Mobile @ H.264 main profile 700 kbps (6 MB/minute)
* SD 480p WiFi @ H.264 main profile 1200 kbps (10 MB/minute)
* HD 720p @ H.264 high profile 2500 kbps (20 MB/minute)
* HD 1080p @ H.264 high profile 5000 kbps (35 MB/minute)

## Screen dimensions
* 240p: 426x240
* 360p: 640x360
* 480p: 854x480
* 720p: 1280x720
* 1080p: 1920x1080
* 1440p (2k): 2560x1440
* 2160p (4k): 3840 x 2160

## Profile levels
[http://blog.mediacoderhq.com/h264-profiles-and-levels]
* Level 3.1
    * High profile max bitrate: 17.500 kbps
    * Other profiles max bitrate: 14.000 kbs
    * Max framerate: 1.280×720@30

* Level 4.1
    * Max bitrate: 50.000 kbps
    * Max framerate: 1.280×720@60


## Current Elastic transcoding profiles
### Iphone
* H.264
* High 4.1
* Bitrate: 5.000 kbps
* 1920x1080

### Webdefault
* H.264
* Baseline 3.1
* Bitrate: 2.400 kbps
* 1280x720

## Elastic transcoding profiles to create

### iPhone
* iPhone HD: H.264 high 4.1 + 5000kbps + 1920x1080
* iPhone SD: H.264 baseline 3.1 + 1200kbps + 1280x720
* iPhone LD: H.264 baseline 3.1 + 350kbps + 426x240

### webDefault
* webDefault HD: H.264 baseline 4.1 + 5000kbps + 1920x1080
* webDefault SD: H.264 baseline 3.1 + 1200kbps + 1280x720
* webDefault LD: H.264 baseline 3.1 + 350kbps + 426x240

## Screen dimensions

[https://www.paintcodeapp.com/news/ultimate-guide-to-iphone-resolutions]


# Algorithm

The video selected can take the following criteria into account:

* UserAgent: iPhone or not
* Screen dimensions
    * Compare max dimension (screen vs video format)
    * Need to take into account a multiplier
* Available bandwidth
    * Hard to do right, lets skip until we adopt the streaming media services


## Codec info

[http://www.leanbackplayer.com/test/h5mt.html]