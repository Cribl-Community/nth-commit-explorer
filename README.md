# Nth Degree Commit Explorer

## Features
Commit Explorer is (hopefully!) the Cribl Version Control exploration UI you've always wanted. Features include:
* Narrow commits to Worker Group, Author, date range, and a message filter.
* Choose to exclude "default" paths - let's you avoid upgrade-related file changes.
* Selecting a commit shows a list of changed files preceded with A/D/M (added/deleted/modified).
* Selecting a file shows a github-style highlighted diff.
* Diff view has a Blame button that generates a "blame" based on the previous commits (limit 50).
* "Generate Summary" button creates a printable summary of the selected commits. NOTE: Must allow popups!.
* "Generate Report" button creates a downloadable HTML report with an expand/collapse feature for each commit/file in the selection. NOTE: Must allow popups!.

## Installing the App

1. Ensure you meet the [requirements for installing a Cribl App](https://docs.cribl.io/apps/admin-guide/#who-can-install-and-manage-apps).
1. Download the latest build from the [repository](https://github.com/nthdegreeworld/nth-commit-explorer/tree/main/build).
2. [Install](https://docs.cribl.io/apps/admin-guide/#import-through-add-app) the App in your Cribl.Cloud environment using the Add App > Import from File option. 

## Getting Started with Development
NOTE: this procedure does not require the App to be pre-installed.
1. Ensure you meet the [requirements](https://docs.cribl.io/apps/quickstart/#before-you-begin).
2. Clone the Repository to your local drive.
3. In your terminal of choice, open a tab, cd into the repository, and run `npm run dev`.
4. In a seperate terminal session (or editor of choice), cd into the repository and run your AI of choice. This repo was created using Claude.
5. In your browser, login to your Organization, Select Apps->View All, click the Development tab (if shown), and choose Live Preview.

You now can start contrubuting to the App... or just use it yourself!

