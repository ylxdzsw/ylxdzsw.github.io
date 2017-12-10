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
            handle = setTimeout alarm, timeout
            livingAlarms[id] = handle
            postMessage action: 'add', id: id
        when 'cancel'
            clearTimeout livingAlarms[data.id]
            delete livingAlarms[data.id]
            postMessage action: 'cancel', id: data.id

