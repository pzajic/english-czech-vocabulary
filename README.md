# English / Czech Vocabulary App

This is a simple static web app for learning vocabulary.

## Features
- switch source/target language
- choose one or more lessons from JSON
- choose the number of words in the quiz (default 10)
- random selection of words from the selected lessons
- manual text input for translation
- submit answers and show the number of wrong answers

## Run locally
From the project folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy to GitHub Pages
1. Push this project to a GitHub repository.
2. Open the repository in GitHub.
3. Go to Settings -> Pages.
4. Select the branch and root folder.
5. Save and wait for the site to publish.

## Vocabulary file
The vocabulary is stored in:

```text
data/vocabulary.json
```

Add new lessons and words there to expand the app over time.
