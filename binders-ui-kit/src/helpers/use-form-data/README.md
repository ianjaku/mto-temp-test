# useFormData

useFormData is a helper that takes away a lot of boilerplate code when working with forms.

## Basic usage

You create a formData variable which has many useful functions to manage your form.
All data management should go through "formData".
It also provides setters and getters to be used any way you see fit.

```tsx
interface IFormData {
    email: string;
    password: string;
}

const formData = useFormData<IFormData>({
    validate: createRequireFieldsValidator(["email", "password"]),
    onSubmit: async (values: IFormData) => {
        await makeApiCall()
    }
});

return (
    <form {...formData.bindForm()}>
        <input type="email" {...formData.bindInput()} />
        <input type="password" {...formData.bindInput()} />
        <Button
            inactiveWithLoader={formData.isLoading}
            onClick={() => formData.submit()}
            text="Submit"
        />
    </form>
)
```

## Set inital values

To set the initial value of some of your form fields you can use "intiValues".
Make sure to use useMemo here!

formData will listen to changes in initValues and update fields accordingly.
If you don't want fields to automatically be updated when dependencies change
you can pass an empty dependency array.

```tsx
const formData = useFormData<IFormData>({
    initValues: useMemo(() => ({
        email: props.email
    }), [props.email]),
    validate: createRequireFieldsValidator(["email", "password"]),
    onSubmit: async (values: IFormData) => {
        await makeApiCall()
    }
});
```

## Validation

Validation is completely optional.

The validate function has to return an object where keys are the fieldNames
and the values are a string array.

If there are no validation errors you can just return an empty object `{}`

For example if email is required yet is missing you would return:
`{email: ["Field is required"]}`

## createRequireFieldsValidator

This is a helper if you want basic require fields validation.
You just pass it some values and the return value is a valid validator function.

```ts
validate: createRequireFieldsValidator(["email", "password"]),
```
