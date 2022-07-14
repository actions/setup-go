# Contributors
Thank you for contributing! 
We have prepared a short guide so that the process of making your contribution is as simple and clear as possible. Please check it out before you contribute!
##  How can I contribute...
 * [Contribute Documentation:green_book:](#contribute-documentation)
 * [Contribute Code :computer:](#contribute-code)
 * [Provide Support on Issues:pencil:](#provide-support-on-issues)
 * [Review Pull Requests:mag:](#review-pull-requests)
  
 ## Contribute documentation 
Documentation is a super important, critical part of this project. Docs are how we keep track of what we're doing, how, and why. It's how we stay on the same page about our policies. And it's how we tell others everything they need in order to be able to use this project  or contribute to it. So thank you in advance.

Documentation contributions of any size are welcome! Feel free to contribute even if you're just rewording a sentence to be more clear, or fixing a spelling mistake!

**How to contribute:** 
Pull requests are the easiest way to contribute changes to git repos at GitHub. They are the preferred contribution method, as they offer a nice way for commenting and amending the proposed changes.

 - Please check that no one else has already created a pull request with these changes.
 - Fork this repository
 - Clone the repository to your local machine
 - Use a "feature branch" for your changes. That separates the changes in the pull request from your other changes and makes it easy to edit/amend commits in the pull request. Workflow using "feature branch":
	- Update your local git fork to the tip (main branch, usually)
	- Create the feature branch
	- Edit or add any relevant documentation
    - Make sure your changes are formatted correctly and consistently with the rest of the documentation
     - Re-read what you wrote, and run a spellchecker on it to make sure you didn't miss anything
	- Commit changes locally
	- Push them to your GitHub fork
	- Go to https://github.com/actions/setup-go/pulls and open a new pull request with your changes.
	- If your pull request is connected to an open issue, add a line in your pull request's description that says Fixes: #123, where #123 is the number of the issue you're fixing.
	- If you later need to add new commits to the pull request, you can simply commit the changes to the local branch and then push them. The pull request gets automatically updated
	
**Once you've filed the pull request:**
 - One or more maintainers will use GitHub's review feature to review your pull request
  - If the maintainer asks for any changes, edit your changes, push, and ask for another review
  - If the maintainer decides to pass on your pull request, they will thank you for the
   contribution and explain why they won't be accepting the changes. That's ok! We still really appreciate you taking the time to do it, and we don't take that lightly :heart:
   - If your PR gets accepted, it will be merged into the latest branch soon after. Your contribution will be distributed to the masses next time the maintainers tag a release
  
## Contribute code

We like code commits a lot! They're super handy, and they keep the project going and doing the work it needs to do to be useful to others.

Code contributions of just about any size are acceptable!

The main difference between code contributions and documentation contributions is that contributing code requires inclusion of relevant tests for the code being added or changed. Contributions without accompanying tests will be held off until a test is added, unless the maintainers consider the specific tests to be either impossible, or way too much of a burden for such a contribution.

**How to contribute:** 
Pull requests are the easiest way to contribute changes to git repos at GitHub. They are the preferred contribution method, as they offer a nice way for commenting and amending the proposed changes.

- Please check that no one else has already created a pull request with these changes
- Fork this repository
- Clone the repository to your local machine
- Use a "feature branch" for your changes. That separates the changes in the pull request from your other changes and makes it easy to edit/amend commits in the pull request. Workflow using "feature branch":
	- Update your local git fork to the tip (main branch, usually)
	- Create the feature branch
	- Add changes and relevant tests
    - **Run `pre-checkin` script to format, build and test changes**
    - Make sure your changes are well formatted and tests pass
	- Commit changes locally
	- Push them to your GitHub fork
	- Go to https://github.com/actions/setup-go/pulls and open a new pull request with your changes.
	- If your pull request is connected to an open issue, add a line in your pull request's description that says Fixes: #123, where #123 is the number of the issue you're fixing.
	- If you later need to add new commits to the pull request, you can simply commit the changes to the local branch and then push them. The pull request gets automatically updated

**Once you've filed the pull request:**
  - CI will start automatically with some checks. Wait for the end of the execution and make sure that all checks passed successfully. If some checks fail, you can make changes to your code
 - One or more maintainers will use GitHub's review feature to review your pull request
  - If the maintainer asks for any changes, edit your changes, push, and ask for another review
  - If the maintainer decides to pass on your pull request, they will thank you for the
   contribution and explain why they won't be accepting the changes. That's ok! We still really appreciate you taking the time to do it, and we don't take that lightly :heart:
   - If your PR gets accepted, it will be merged into the latest branch soon after. Your contribution will be distributed to the masses next time the maintainers tag a release
 
 ## Provide support on issues

Helping out other users with their questions is a really awesome way of contributing to any community. It's not uncommon for most of the issues on an open source projects being support-related questions by users trying to understand something they ran into, or find their way around a known bug.

**In order to help other folks out with their questions:**

 - Go to the [issue tracker](https://github.com/actions/setup-go/issues)
 - Read through the list until you find something that you're familiar enough with to give an answer to 
 - Respond to the issue with whatever details are needed to clarify the question, or get more details about  what's going on
 - Once the discussion wraps up and things are clarified, ask the original issue filer (or a maintainer) to close it for you

*Some notes on picking up support issues:*

 - Avoid responding to issues you don't know you can answer accurately
 - As much as possible, try to refer to past issues with accepted answers. Link to them from your replies with the #123 format
 - Be kind and patient with users -- often, folks who have run into confusing things might be upset or impatient. This is ok. Try to understand where they're coming from, and if you're too uncomfortable with the tone, feel free to stay away or withdraw from the issue. *(note: if the user is outright hostile or is violating the CoC, refer to the [Code of Conduct](https://github.com/actions/setup-go/blob/main/CODE_OF_CONDUCT.md) to resolve the conflict)*

## Review pull requests

Another great way to contribute is pull request reviews. Please, be extra kind: people who submit code/doc contributions are putting themselves in a pretty vulnerable position, and have put time and care into what they've done (even if that's not obvious to you!) -- always respond with respect, be understanding, but don't feel like you need to sacrifice your standards for their sake, either. 

**How to review:**
 - Go to the [pull requests](https://github.com/actions/setup-go/pulls)
 - Make sure you're familiar with the code or documentation being updated, unless it's a minor change (spellchecking, minor formatting, etc.)
- Review changes using the GitHub functionality. You can ask a clarifying question, point out an error or suggest an alternative. (Note: You may ask for minor changes ("nitpicks"), but consider whether they are really blockers to merging or not)
- Submit your review, which may include comments, an approval, or a changes request