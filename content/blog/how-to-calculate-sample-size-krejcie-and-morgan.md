---
title: How to calculate sample size with Krejcie and Morgan (worked examples)
description: Work out your sample size with the Krejcie and Morgan formula, step by step, with two worked examples, a quick table and how to write it up in your methodology.
date: 2026-11-23
tool: methodology
tags: methodology, sampling, proposal
draft: false
---
"How did you get this number?" It is one of the questions supervisors ask most often about a methodology chapter, and one of the easiest to get wrong. Many students copy a sample size from a past dissertation, or pick a round number like 100, and then cannot defend it at the proposal hearing.

Delays like this add up. A 2025 review of research supervision in Uganda reports that, of 3,110 postgraduate students registered at Makerere University in 2016, only 1,310 (42%) completed on time, and it lists "lack of proper guidance by supervisors" among the challenges master's students face ([Turyamureeba, 2025, *East African Journal of Education Studies*](https://www.journals.eanso.org/index.php/eajes/article/download/2969/3578)). University guidelines expect you to show your working: the [UTAMU proposal and dissertation guidelines](https://utamu.ac.ug/wp-content/uploads/2024/02/Guidelines-for-Proposal-and-Dissertation-at-UTAMU.pdf), for example, give sample-size determination its own section in the methodology.

You cannot always get more time with your supervisor. You can arrive with a sample size you calculated yourself and can explain line by line. This guide shows you how, with the Krejcie and Morgan method that many East African departments ask for.

## The short answer

The Krejcie and Morgan (1970) method tells you how many people to sample from a **known, finite population** at 95% confidence and a 5% margin of error. For a population of 1,000 you need 278; for 10,000 you need 370; and however large the population grows, the figure levels off at about 384. You can read the number off their table or work it out with one formula.

## What is the Krejcie and Morgan method?

In 1970, Robert Krejcie and Daryle Morgan published a short paper with a table of sample sizes for populations from 10 to 1,000,000. Supervisors in Uganda and across East Africa still ask for it because it is quick, standard and easy to defend. It suits surveys where you can count your population: teachers in a district, nurses in a hospital, registered members of a SACCO.

It has limits. It assumes simple random sampling and a yes/no style estimate. For qualitative interviews or focus groups it does not apply at all.

## The formula

s = X² × N × P × (1 − P) ÷ [d² × (N − 1) + X² × P × (1 − P)]

- **s** = required sample size
- **N** = population size
- **X²** = chi-square value for 1 degree of freedom at 95% confidence, which is 3.841
- **P** = population proportion, set at 0.5 to give the largest sample
- **d** = margin of error, 0.05

With P = 0.5, P × (1 − P) is 0.25, and d² is 0.0025. Those two numbers do most of the work.

## Worked example 1: teachers in one district

Say your population is 1,250 secondary-school teachers in one district (an invented figure for practice).

1. Top line: 3.841 × 1,250 × 0.25 = 1,200.3
2. Bottom line: 0.0025 × 1,249 + 3.841 × 0.25 = 3.1225 + 0.9603 = 4.0828
3. Divide: 1,200.3 ÷ 4.0828 = 294.0

Your sample is 294 teachers.

**A note on rounding.** Krejcie and Morgan's published table rounds to the nearest whole number, which is why the table below shows 44 for a population of 50 (the formula gives 44.34). When you calculate your own figure, many supervisors prefer that you round **up**, so the sample is never smaller than the formula asks for. Whichever you do, say so in one line.

## Worked example 2: a SACCO, with groups and non-response

Now a harder case. Your study is on savings behaviour among the 420 registered members of a SACCO in Mbale (again, invented for practice). The members fall into three groups: 180 farmers, 140 traders and 100 boda boda riders.

**Step 1: the sample size.**

1. Top line: 3.841 × 420 × 0.25 = 403.3
2. Bottom line: 0.0025 × 419 + 0.9603 = 1.0475 + 0.9603 = 2.0078
3. Divide: 403.3 ÷ 2.0078 = 200.9, rounded up to **201**

**Step 2: share it across the groups in proportion.** Multiply 201 by each group's share of the population:

- Farmers: 201 × 180 ÷ 420 = 86.1, rounded up to 87
- Traders: 201 × 140 ÷ 420 = 67.0, so 67
- Boda boda riders: 201 × 100 ÷ 420 = 47.9, rounded up to 48

That gives 202 in total, one more than 201 because of rounding up. That is fine; say so in your methodology.

**Step 3: allow for people who do not respond.** If you expect 70% of questionnaires back, divide by 0.7: 201 ÷ 0.7 = 287.1, so hand out **288**. Give a reason for the 70%, for example the response rate an earlier study reported in a similar setting. Do not make the figure up.

Notice what changed between the two examples. The population fell from 1,250 to 420, but the sample only fell from 294 to 201. Small populations need a large share sampled; large ones need a small share. That is the pattern in the table.

## Quick table

| Population (N) | Sample (s) |
|---|---|
| 50 | 44 |
| 100 | 80 |
| 200 | 132 |
| 300 | 169 |
| 500 | 217 |
| 1,000 | 278 |
| 2,000 | 322 |
| 5,000 | 357 |
| 10,000 | 370 |
| 1,000,000 | 384 |

Figures from the formula above, rounded to the nearest whole number as in Krejcie and Morgan's published table.

## How to write it in your methodology

A plain version for example 1: "The study population was 1,250 secondary-school teachers. Using Krejcie and Morgan's (1970) formula at 95% confidence and a 5% margin of error, the sample size was 294, allocated proportionally across the three school types." Then give the formula, the values you used, how you rounded and the reference.

Keep three things together in the same paragraph or the next one:

- **Why this number:** the formula and its values.
- **How you will choose them:** simple random, stratified or systematic sampling, and from what list (the sampling frame).
- **What you will do if people do not respond:** the non-response allowance and where it comes from.

Supervisors often send chapters back because one of the three is missing, not because the number is wrong.

## Common mistakes

- **Using it for an unknown or open population**, such as "all mobile-money users in Uganda". You cannot count that population, so use Cochran's formula instead.
- **Applying it to qualitative work.** Interviews and focus groups are judged by depth and saturation, not by a formula.
- **Choosing the number first and the sampling method later.** Say how you will choose the 294 as well as why 294.
- **Mixing up formulas.** If your department asks for Yamane, use Yamane; do not label a Krejcie and Morgan figure as Yamane.
- **Leaving out the reference.** Cite the 1970 paper, not a website that copied the table.

## FAQ

**Is Krejcie and Morgan the same as Yamane?**
No. Yamane's formula, n = N ÷ (1 + N × e²), gives a slightly different figure. For N = 1,250 at e = 0.05 it gives 303.03, so 304 rounded up, against 294 with Krejcie and Morgan. Check which one your department expects.

**Can I use it for a population of 30?**
You can, but at small sizes it asks for almost everyone: 28 of 30. Many supervisors then simply expect a census of all 30.

**Does it work for a PhD?**
Yes, for the survey strand of the study, with the same assumptions. A PhD examiner may also ask you to justify the 5% margin of error and the confidence level, so be ready.

**What if my population list is out of date?**
Use the most recent list you can get, say where it came from and when, and note the gap as a limitation. A sampling frame you can name is better than a perfect number you cannot trace.

## Plan the rest of your methodology

Sample size is one line of a methodology chapter. The free Methodology Builder on Academic Catalyst helps you plan the rest: design, population, sampling, instruments, analysis by objective, validity and ethics. It calculates sample size by Yamane, Krejcie and Morgan or Cochran with the working shown, so you can check each step and write it up in your own words. It needs a free account, with 3 free plans a month.

[Start the Methodology Builder](https://academic-catalyst.app/tools/methodology?utm_source=blog&utm_medium=referral&utm_campaign=2026-11-23)

**Reference**

Krejcie, R. V., & Morgan, D. W. (1970). Determining sample size for research activities. *Educational and Psychological Measurement, 30*(3), 607–610.
