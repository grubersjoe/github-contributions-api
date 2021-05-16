import app from './index';

app.listen(process.env.PORT ?? 8080, () =>
  console.log(
    `Server listening on http://localhost:${process.env.PORT || 8080}`,
  ),
);
