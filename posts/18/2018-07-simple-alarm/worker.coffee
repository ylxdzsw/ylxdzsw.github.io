livingAlarms = Object.create null

self.onmessage = ({data}) ->
    switch data.action
        when 'add'
            {id, timeout, message="alarm!"} = data
            alarm = ->
                notification = new Notification message
                notification.onclick = -> do @close
                delete livingAlarms[id]
                postMessage action: 'finish', id: id
            livingAlarms[id] = setTimeout alarm, timeout
            time = new Date timeout + +new Date
            postMessage action: 'add', id: id, message: message, time: time
        when 'cancel'
            clearTimeout livingAlarms[data.id]
            delete livingAlarms[data.id]
            postMessage action: 'cancel', id: data.id
        else
            console.error "unknown action"

