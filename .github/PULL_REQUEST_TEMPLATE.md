**Description**
A clear and concise description of what this pull request solves.

**Issue**
Fixes: (link to issue)

**Example**
A GIF or video showing the old and new behaviors after this pull request is merged. (If you don't include this, your pull request will not be reviewed as quickly, because it's much too hard to figure out exactly what is going wrong, and it makes maintenance much harder.)

**Context**
If your change is non-trivial, please include a description of how the new logic works, and why you decided to solve it the way you did. (This is incredibly helpful so that reviewers don't have to guess your intentions based on the code, and without it your pull request will likely not be reviewed as quickly.)

**Checks**

- [ ] The new code matches the existing patterns and styles.
- [ ] The linter passes with `pnpm run lint`.
- [ ] The formatter passes with `pnpm run format-check`
- [ ] The tests pass with `pnpm run test`.
- [ ] You've [added a changeset](https://github.com/atlassian/changesets/blob/master/docs/adding-a-changeset.md) if changing functionality. (Add one with `pnpm exec changeset add`.)
