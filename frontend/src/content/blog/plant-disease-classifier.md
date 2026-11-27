---
title: "Teaching a Model to Diagnose Plant Diseases from One Photo"
description: "What I learned building a crop and disease classifier for my graduation project: what worked, what didn't, and how good it really is."
date: 2026-10-30
tags: [machine learning, computer vision, agriculture, deep learning]
draft: true
---

# Teaching a Model to Diagnose Plant Diseases from One Photo

For my graduation project I built an image classifier that looks at a single photo of a leaf and answers three
questions:

1. **Which crop is this?**
2. **Is it healthy, and if not, which disease does it have?**
3. **Should I even answer?** If the photo isn't a leaf of a crop I know, or I'm unsure, the model should say so
   instead of guessing.

It covers **7 crops** (tomato, potato, corn, apple, grape, rice and cassava) and **33 crop/disease classes** in total.
I connected it to my team's agriculture web app, so a farmer can upload a photo and get a diagnosis with advice.

This post covers what I tried, what actually helped, and an honest look at how good the model is.

## The data problem

Plant disease datasets are everywhere online, but they have a catch. The most famous one, PlantVillage, was
photographed in a lab: one leaf, a plain background, perfect lighting. Models trained on it score 99%+, and then
fall apart on a real photo taken in a field.

So I combined **25 public datasets**, a mix of lab photos and real field photos from different countries, into one
collection of about 250,000 images. Merging them meant a lot of unglamorous work:

- **Unifying labels.** Every dataset names classes differently, so they all had to be mapped onto one shared list.
- **Removing duplicates.** The same photo often appears in several datasets. I used image fingerprints (perceptual
  hashes) and image embeddings to find copies, so that no test photo is secretly also a training photo.
- **Adding "not a plant" images.** People, objects and other plants, so the model learns what to reject.

The most important decision was how to test. A normal random split is too easy, because photos from the same dataset
look alike. So I **held back three entire datasets** (grape, corn and rice photos from different sources) that the
model never saw during training. That's the honest test: _how does it do on photos from a new farm, camera or
country?_

## The model

The model is built on large pretrained vision networks (DINOv2 vision transformers and ConvNeXt), fine-tuned on the
plant data. Three design choices mattered:

- **Two-step prediction.** The model first predicts the crop, then the disease _given_ the crop, and combines the two.
  This stops it from mixing up, say, a corn disease with a tomato one.
- **Calibrated confidence.** Neural networks are often overconfident. I used _temperature scaling_ so that "80% sure"
  actually means about 80% correct, which makes the "retake the photo" decision meaningful.
- **An ensemble.** The final system averages five models of different designs and sizes. Two of the large ones were
  trained on Google Colab GPUs, the rest on my own PC with an 8 GB card.

## The experiments: most of my ideas lost

I ran a series of controlled experiments. I trained the baseline several times with different random seeds to measure how much the score moves. An idea only "won" if it beat the baseline
by more than twice that noise.

| Idea                                                                          | Result                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Train on lab photos only, field photos only, or both?                         | **Both wins.** Lab-only scored just 0.15 on field photos, a dramatic failure |
| Replace photo backgrounds during training, to stop the model relying on them? | Lost, so I didn't use it                                                     |
| Automatically crop to the leaf before classifying?                            | Lost, so I didn't use it                                                     |
| Train without the "not a plant" examples?                                     | Lost: the model needs those examples                                         |
| Which pretrained network is best?                                             | A tie, so I combined several of them                                         |
| Single model or ensemble?                                                     | **The ensemble won**                                                         |

The biggest lesson: **the data mattered far more than the clever tricks.** Mixing lab and field photos was worth
more than everything else combined.

## How good is it?

| Test                                            | Result            |
| ----------------------------------------------- | ----------------- |
| Field photos from the same sources as training  | **0.96** macro-F1 |
| Photos from datasets it never saw               | **0.59** macro-F1 |
| Telling real leaves apart from non-plant images | **0.99** AUROC    |

_Macro-F1 is an accuracy-like score where every class counts equally, so rare diseases matter as much as common ones.
AUROC measures how well it separates two groups; 1.0 is perfect._

The gap between 0.96 and 0.59 is the real story of this project. On photos that look like its training data, the model
is excellent. On photos from **new sources**, it still recognises the **crop about 9 times in 10**, but gets the
exact **disease only about 6 times in 10**. Part of that is likely datasets disagreeing on what counts as "healthy"
or "mildly diseased", but much of it is a genuine limitation.

### A second check: photos from the web

Three held-out datasets is a narrow test, so I ran another. I collected around 400 photos from university extension
services and agriculture websites. I removed anything that wasn't a real photo of a leaf (there were surprisingly many
drawings, microscope images and unrelated pictures). I also removed **28 photos that turned out to already be in my
training data**: popular plant photos get copied all over the internet.

On the remaining **260 web photos the model had never seen**:

- **Crop correct: 91%.**
- **Disease correct: 67%.**
- **The correct answer was in its top 3 guesses: 86%.**
- **When it gave a confident answer (73% of photos), it was right 77% of the time.**

Grape, cassava and corn did well, at 76–91%. Apple, potato and rice were weaker, at around 50%. Healthy potato leaves
were the worst case: the model kept calling them diseased.

This test is small and the labels come from the web pages themselves, not from an expert, so treat it as a sanity
check rather than a benchmark. But it tells the same story: **strong crop recognition, decent but imperfect disease
diagnosis on new photos.**

## Knowing when not to answer

A diagnosis tool that confidently mislabels a photo of a cat is worse than useless. So every prediction gets one of
three statuses:

- **ok:** confident enough to give a diagnosis.
- **retake:** unsure; ask for a closer, sharper photo of a single leaf.
- **unsupported:** this doesn't look like a leaf of a crop I know.

Getting the thresholds right took real-world testing. My first version set them statistically from validation photos,
and it asked users to retake far too many perfectly good photos. The model is _so_ confident on validation data that
"the least confident 20%" still meant 99% confidence. I switched to simpler, more practical cut-offs after checking
how often the flagged answers were actually wrong. In the web test, the "unsupported" check rejected **every one** of
the photos that showed no plant at all.

## Putting it in a real app

The model runs behind the team web app's existing API. The user uploads a photo and gets back:

- the crop and disease;
- a confidence score;
- the top 3 alternatives;
- treatment advice where the app has it;
- or a request to retake the photo.

On a consumer GPU, the full five-model ensemble answers in **under a second** once loaded. A faster single-model mode
answers in **under 0.2 seconds**.

## What I'd do differently

- **Collect more varied field data early.** The held-out results show that variety of sources beats model size.
- **Check label agreement between datasets.** Several "errors" were really datasets disagreeing with each other.
- **Test on real-world photos sooner.** The web test changed how I set the rejection thresholds, and I wish I'd
  done it earlier.

## A note on licences

Several of the public datasets I trained on allow only non-commercial use. That's why this model stays a research
prototype: I don't distribute the trained weights or the data. A commercially usable version, trained only on
permissively licensed data, is planned as a next step.

## Takeaways

1. **Your test set decides whether you're fooling yourself.** Holding back entire datasets gave a much more honest
   (and humbling) number than a random split.
2. **Data beats tricks.** Mixing lab and field photos mattered far more than any architecture change.
3. **A model that can say "I don't know" is far more useful** than one that's always confident.
4. **Measure noise before declaring a winner.** Most "improvements" disappeared once I accounted for random variation
   between training runs.
