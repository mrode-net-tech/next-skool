import express from 'express';
import healthRouter from '@routes/health';
import homeRouter from '@routes/home';
import taskRouter from '@routes/tasks';
import { errorHandler } from '@middleware/error-handler';

const app = express();
app.use(express.json());
app.use(healthRouter);
app.use(homeRouter);
app.use(taskRouter);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
