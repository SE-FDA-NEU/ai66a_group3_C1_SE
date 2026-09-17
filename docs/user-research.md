# User research

## Method

An anonymous questionnaire survey collected 8 valid responses from university
students aged 18-20. The survey asked about movie-watching habits,
movie-selection behaviour, pain points, information needs, feature priorities,
rating behaviour, cold-start preferences, and no-result preferences.

The raw survey spreadsheet and the original response summary are kept outside
the public repository. They contain timestamps and free-text responses, so this
document records only aggregated and anonymized findings.

## Findings

### Movie-selection problem

- 6 of 8 respondents spent at least 15 minutes choosing a movie or gave up and
  rewatched an old movie.
- 6 of 8 respondents reported that too many available movies made it difficult
  to decide.
- 5 of 8 respondents were unsure whether a movie would suit their current mood.

The main problem is choice overload rather than a lack of available movies.

### Information and discovery preferences

- Genre was selected by 6 of 8 respondents as important information before
  choosing a movie.
- Rating was selected by 4 of 8 respondents; overview, trailer or image, and a
  recommendation reason were each selected by 3 of 8 respondents.
- Selecting favourite genres, personalised recommendations, and genre filtering
  each received an average importance score of 4.125 out of 5.
- Viewing similar movies received an average importance score of 3.625 out of
  5.

### Cold-start and no-result behaviour

- 5 of 8 respondents preferred both popular movies and a genre-selection action
  when no preferences were available.
- 6 of 8 respondents preferred popular alternatives when no matching movie was
  found.

### Rating behaviour

- No respondent rated movies frequently: 4 rated sometimes, 2 rated rarely,
  and 2 had never rated a movie.
- Willingness to rate movies when doing so improves future recommendations
  averaged 3.875 out of 5.

Ratings should therefore remain optional feedback, not a requirement for using
the recommendation flow.

## Suggested implications for PO review

| Research finding | Requirement implication |
| --- | --- |
| Choice overload is common | Display a bounded list of relevant recommendations rather than trying to fill an unlimited list. |
| Genre is the most requested input | Keep genre selection as the first personalisation input. |
| Genre filtering has a high importance score | Consider genre filtering part of the core user flow. |
| Users want guidance without preferences | Show popular movies and a visible action to select genres for cold-start users. |
| Users want a recovery path after no match | Show popular alternatives and allow users to edit their preferences. |
| Ratings are not habitual | Keep ratings optional and use them only to improve later recommendations. |
| Mood matters to some users | Keep mood-based discovery as a future research question until a practical data source and acceptance criteria exist. |

## Limitations

The sample is small and consists only of university students aged 18-20. These
findings guide the initial MVP and personas; they do not represent all movie
viewers.
