# SchoolPicker

A searchable single choice list of campuses, each with its two school colors.

**Consumer provides:** `schools` (`id`, `name`, `city`, `colors` as two hex values, optional `status: 'soon'`), `value`, `onChange`, and `query` with `onSearch` for the search field.

- Picking a school applies its theme to the next screen.
- Schools not open yet stay in the list with Coming soon, never hidden, and cannot be selected.
- The selected row uses `surface-brand` with an `accent` border and a check.
