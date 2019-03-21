const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongo = require('mongodb')

var db

mongo.MongoClient.connect(process.env.MLAB_URI, (err, client) => {
  db = client.db('ffc-proto')
})

app.use(bodyParser.urlencoded({extended : true}))

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

app.post('/api/exercise/add', (req, res) => {
  var date = new Date().getTime()
  if (req.body.dat) {
    date = new Date(req.body.date).getTime()
  }
  const users = db.collection('users')
  users.find({
    '_id': mongo.ObjectId(req.body.userId)
  }).toArray(function (err, docs) {
    if (err) {
      console.log(err)
      res.status(500).send('Internal Server Error!')
    } else {
      if (docs.length > 0) {
        const activities = db.collection('activites')
        activities.insertOne({
          userId: docs[0]._id,
          description: req.body.description,
          duration: req.body.duration,
          date: date
        }, function (err, result) {
          if (err) {
            console.log(err)
            res.status(500).send('Internal Server Error!')
          } else {
            res.json({
              'username': docs[0].username,
              'description': req.body.description,
              'duration': req.body.duration,
              '_id': docs[0]._id,
              'date': new Date(date).toDateString()
            })
          }
        })
      } else {
        res.status(400).send('Invalid User ID: ' + req.body.userId)
      }
    }
  })
});

app.post('/api/exercise/new-user', (req, res) => {
  const users = db.collection('users')
  users.find({
    username: req.body.username
  }).toArray(function (err, documents) {
    if (err) {
      console.log(err)
      res.status(500).send('Internal Server Error!')
    } else {
      if (documents.length > 0) {
        res.status(400).send('username already taken.')
      } else {
        users.insertOne({'username': req.body.username}, function (err, result) {
          if (err) {
            console.log(err)
            res.status(500).send('Internal Server Error!')
          } else {
            res.json({
              'username': req.body.username,
              '_id': result.insertedId
            })
          }
        })
      }
    }
  })
});

app.get('/api/exercise/log', (req, res) => {
  var options = {from: null, to: null, limit: 0}
  var params = {
    'userId': mongo.ObjectId(req.query.userId)
  }
  if (req.query.from && req.query.to) {
    if (!isNaN(Date.parse(req.query.from)) && !isNaN(Date.parse(req.query.to))) {
      params['date'] = {
        $gte: Date.parse(req.query.from), 
        $lte: Date.parse(req.query.to)
      }
    }
  } else if (req.query.to) {
    if (!isNaN(Date.parse(req.query.to))) {
      params['date'] = { $lte: Date.parse(req.query.to) }
    }
  } else if (req.query.from) {
    if (!isNaN(Date.parse(req.query.from))) {
      params['date'] = { $gte: Date.parse(req.query.from) }
    }
  }
  if (req.query.limit && !isNaN(req.query.limit)) {
    options.limit = Math.ceil(Math.abs(req.query.limit))
  }
  if (!req.query.userId) {
    res.status(400).send('Invalid User ID!')
  } else {
    const user = db.collection('users')
    const activitie = db.collection('activites')
    user.find({
      '_id': mongo.ObjectId(req.query.userId)
    }).toArray(function (err,users) {
      if (err) {
        console.log(err)
        res.status(500).send('Internal Server Error')
      } else {
        if (users.length > 0) {
          var cursor = activitie.find(params)
          if (options.limit) {
            cursor = cursor.sort('date', 1).limit(options.limit)
          }
          cursor.toArray(function (err, activities) {
            if (err) {
              console.log(err)
              res.status(500).send('Internal Server Error!')
            } else {
              var data = {
                _id: req.query.userId,
                username: users[0].username,
                count: activities.length,
                log: []
              }
              for (var i = 0; i < activities.length; i++) {
                data.log.push({
                  'description': activities[i].description,
                  'duration': activities[i].duration,
                  'date': new Date(activities[i].date).toDateString()
                })
              }
              res.json(data)
            }
          })
        } else {
          res.status(400).send('Invalid User ID: ' + req.query.userId)
        }
      }
    })
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
