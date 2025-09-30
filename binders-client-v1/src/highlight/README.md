# Highlighting

This module is focussed around higlighting pieces of text
mostly focussed around text to speech and raw html.

## Boundary

A Boundary is a piece of a text with a time at which it is played.

It always belongs to an audio track.

Contains:

- the text that will be played
- when it will be played
- the index at which you can find the text in the original string

## Boundary loop

This is a loop, used to synchronize highlighting with an audio fragment.

It has a static method `fromAudioEvents` which links it to an HTMLAudioElement for ease of use.
