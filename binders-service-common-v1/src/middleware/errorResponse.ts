export function buildSafeErrorResponse(): string {
    return `
<html>
<head>
<style>
body {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}
.error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
</style>
</head>
<body>
<div class="error">
<h1>Something went wrong</h1>
<p>Please, try again later, or contact the support.</p>
</div>
</body>
</html>
`
}
